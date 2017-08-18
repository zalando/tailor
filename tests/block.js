'use strict';

const assert = require('assert');
// const http = require('http');
const nock = require('nock');
const sinon = require('sinon');

const stream = require('stream');

const buildBlock = require('../lib/block').buildBlock;
const requestFragment = require('../lib/request-fragment')(require('../lib/filter-headers'));
const AsyncStream = require('../lib/streams/async-stream');

describe('Tailor::Block', () => {
    let block;
    let context;
    let handleNestedTag;

    beforeEach(() => {
        const mockedRequest = {
            headers: {},
            url: '/'
        };

        nock('http://fragment')
            .get('/f1').reply(200, '<NormalFragment 1/>', {
                'Link': '<http://link1>; rel="fragment-script", <http://link2>; rel="fragment-script", <http://link3>; rel="fragment-script",' +
                '<http://link4>; rel="fragment-script", <http://link5>; rel="fragment-script", <http://link6>; rel="fragment-script"'
            })
            .get('/f2').reply(200, '<NormalFragment 2/>')
            .get('/f3').reply(200, '<NormalFragment 3/>')
            .get('/r1').reply(200, '<RemoteFragment 1/>')
            .get('/r2').reply(200, '<RemoteFragment 2/>')
            .get('/primary').reply(200, '<Primary/>')
            .get('/bad').reply(500, 'Internal Error')
            .get('/fallback').reply(200, '<FallbackFragment 2/>');

        const parseTemplate = () => {
            return [
                { name: 'fragment', attributes: { id: 'r1', src: 'http://fragment/r1' } },
                { name: 'fragment', attributes: { id: 'r2', src: 'http://fragment/r2' } }
            ];
        };

        handleNestedTag = (request, context) => {
            // Simulate fetching of some remote resource here
            // TODO: who does the parsing???
            const stream = buildBlock(mockedRequest, context);
            setTimeout(() => {
                // For now ignored :)
                const remoteEndpointResponse = '<a/><b/><c/>';
                // options are to control the flow — we don't need placeholders in nested templates
                const template = parseTemplate(remoteEndpointResponse, { async: false, pipe: false });
                template.forEach(parsedTag => {
                    stream.write(parsedTag);
                });
                stream.end();
            }, 10);
            return [stream];

        };

        context = {
            index: 0,
            maxAssetLinks: 3,
            dynamicContextAttribute: 'dynamic',
            fetchDynamicContext: sinon.spy(() => Promise.resolve({ gotDynamic: true })),
            pipeDefinition: (name) => Buffer.from(`<pipe id="${name}" />`),
            pipeAttributes: (attributes) => ({ id: attributes.id }),
            pipeInstanceName: 'TailorPipe',
            asyncStream: new AsyncStream(),
            handleTag: handleNestedTag,
            requestFragment: requestFragment
        };
        block = buildBlock(mockedRequest, context);
    });

    it('returns a stream', () => {
        assert(block instanceof stream);
    });

    describe('result stream', () => {
        it('produces buffers as result', (done) => {
            block.on('data', chunk => {
                assert(chunk instanceof Buffer);
            });
            block.on('end', () => {
                done();
            });
            block.on('primary:found', () => {
                context.asyncStream.end();
            });
            block.write({ placeholder: 'pipe' });
            block.write({ name: 'fragment', attributes: { id: 'f3', async: true, src: 'http://fragment/f3' } });
            block.write({ name: 'fragment', attributes: { id: 'f1', dynamic: true, src: 'http://fragment/f1' } });
            // block.write({ name: 'fragment', attributes: { id: 'f1', src: 'http://fragment/f1' } });
            block.write({ name: 'fragment', attributes: { id: 'f2', primary: true, src: 'http://fragment/primary' } });
            block.write({ name: 'content-broker' });
            block.write({ placeholder: 'async' });
            block.end();
        });

        // Parsing is kinda debatable...
        it('parses the template');

        it('requests dynamic fragment context when needed', (done) => {
            block.on('end', () => {
                done();
            });
            block.on('primary:found', () => {
                context.asyncStream.end();
            });
            block.resume();
            block.write({ placeholder: 'pipe' });
            block.write({ name: 'fragment', attributes: { id: 'f3', async: true, src: 'http://fragment/f3' } });
            block.write({ name: 'fragment', attributes: { id: 'f1', dynamic: true, src: 'http://fragment/f1' } });
            block.write({ name: 'fragment', attributes: { id: 'f2', primary: true, src: 'http://fragment/f2' } });
            block.write({ placeholder: 'async' });
            block.end();


            assert.equal(context.fetchDynamicContext.callCount, 1);
        });

        it('notifies when its found in the template', (done) => {
            const onPrimary = sinon.spy();

            block.on('primary:found', onPrimary);
            block.on('end', () => {
                assert.equal(onPrimary.callCount, 1);
                done();
            });
            block.resume();
            context.asyncStream.end();
            block.write({ placeholder: 'pipe' });
            block.write({ name: 'fragment', attributes: { id: 'f2', primary: true, src: 'http://fragment/f2' } });
            block.write({ placeholder: 'async' });
            block.end();
        });
        it('insert pipe definition in the beginning');
        it('insert async results at the end');
        it('uses updated context everytime custom tag handling is performed');
        it('emits new context once done processing');
        it('handles indexes correctly');
    });
});
