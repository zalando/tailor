'use strict';

const assert = require('assert');
// const http = require('http');
const nock = require('nock');
const sinon = require('sinon');

const stream = require('stream');

const processTemplate = require('../lib/process-template');
const requestFragment = require('../lib/request-fragment')(require('../lib/filter-headers'));
const AsyncStream = require('../lib/streams/async-stream');
const parseTemplate = require('../lib/parse-template');

describe('processTemplate', () => {
    let resultStream;
    let options;
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


        handleNestedTag = (request, tag, options, context) => {
            if (tag && tag.name === 'nested-fragments') {
                // Simulate fetching of some remote resource here
                // TODO: who does the parsing???
                const stream = processTemplate(request, options, context);
                setTimeout(() => {
                    const remoteEndpointResponse = `
                    <fragment id="r1" src="http://fragment/r1" />
                    <fragment id="r2" src="http://fragment/r2" />
                    `;

                    options.parseTemplate(remoteEndpointResponse, null, false).then(template => {
                        template.forEach(parsedTag => {
                            stream.write(parsedTag);
                        });
                        stream.end();
                    });
                }, 10);
                return stream;
            }

            return Buffer.of('');
        };

        let index = 0;

        options = {
            maxAssetLinks: 3,
            nextIndex: () => ++index,
            fragmentTag: 'fragment',
            parseTemplate: parseTemplate(['fragment', 'nested-fragments'], ['script']),
            pipeDefinition: (name) => Buffer.from(`<pipe id="${name}" />`),
            pipeAttributes: (attributes) => ({ id: attributes.id }),
            pipeInstanceName: 'TailorPipe',
            asyncStream: new AsyncStream(),
            handleTag: handleNestedTag,
            requestFragment: requestFragment
        };
        resultStream = processTemplate(mockedRequest, options, {});
    });

    it('returns a stream', () => {
        assert(resultStream instanceof stream);
    });

    describe('result stream', () => {
        it('produces buffers as result', (done) => {
            resultStream.on('data', chunk => {
                assert(chunk instanceof Buffer);
            });
            resultStream.on('end', () => {
                done();
            });
            resultStream.on('primary:found', () => {
                options.asyncStream.end();
            });
            resultStream.write({ placeholder: 'pipe' });
            resultStream.write({ name: 'fragment', attributes: { id: 'f3', async: true, src: 'http://fragment/f3' } });
            resultStream.write({ name: 'fragment', attributes: { id: 'f1', src: 'http://fragment/f1' } });
            // resultStream.write({ name: 'fragment', attributes: { id: 'f1', src: 'http://fragment/f1' } });
            resultStream.write({ name: 'fragment', attributes: { id: 'f2', primary: true, src: 'http://fragment/primary' } });
            resultStream.write({ name: 'nested-fragments' });
            resultStream.write({ placeholder: 'async' });
            resultStream.end();
        });

        it('notifies when its found in the template', (done) => {
            const onPrimary = sinon.spy();

            resultStream.on('primary:found', onPrimary);
            resultStream.on('end', () => {
                assert.equal(onPrimary.callCount, 1);
                done();
            });
            resultStream.resume();
            options.asyncStream.end();
            resultStream.write({ placeholder: 'pipe' });
            resultStream.write({ name: 'fragment', attributes: { id: 'f2', primary: true, src: 'http://fragment/f2' } });
            resultStream.write({ placeholder: 'async' });
            resultStream.end();
        });
        it('insert pipe definition in the beginning');
        it('insert async results at the end');
        it('uses updated context everytime custom tag handling is performed');
        it('emits new context once done processing');
        it('handles indexes correctly');
    });
});