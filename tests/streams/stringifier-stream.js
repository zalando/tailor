'use strict';
const PassThrough = require('stream').PassThrough;
const assert = require('assert');
const parseTemplate = require('../../lib/parse-template');
const StringifierStream = require('../../lib/streams/stringifier-stream');

function getTemplate(template, specialTags, pipeBeforeTags) {
    specialTags = specialTags || ['fragment'];
    pipeBeforeTags = pipeBeforeTags || [];
    return parseTemplate(specialTags, pipeBeforeTags)(template);
}

describe('Stringifier Stream', () => {

    it('should stream the content from a fragment tag', () => {
        let st = new PassThrough();
        const templatePromise = getTemplate('<fragment title="mock"></fragment>');
        return templatePromise.then(nodes => {
            let data = '';
            const stream = new StringifierStream((tag) => {
                if (tag && tag.name) {
                    assert.deepEqual(tag.attributes, { title: 'mock' });
                    return st;
                }
                return '';
            });
            stream.on('data', (chunk) => {
                data += chunk;
            });
            stream.on('end', () => {
                assert.equal(data, '<html><head></head><body>mock</body></html>');
                done();
            });
            stream.end(nodes);
            st.end('mock');
        });
    });

    it('shoudl consume stream asynchronously', (done) => {
        const templatePromise = getTemplate('<fragment id="1"></fragment><fragment id="2"></fragment>');
        return templatePromise.then((nodes) => {
            let data = '';
            let streams = [new PassThrough(), new PassThrough()];
            const stream = new StringifierStream((tag) => {
                if (tag && tag.name) {
                    return streams[tag.attributes.id - 1];
                }
                return '';
            });
            stream.on('data', (chunk) => {
                data += chunk;
            });
            stream.on('end', () => {
                assert.equal(data, '<html><head></head><body>12</body></html>');
                done();
            });
            stream.end(nodes);
            setTimeout(() => {
                streams[0].end('1');
            }, 10);
            streams[1].end('2');
        });
    });

    it('should emit an error if a fragment is not handled', (done) => {
        return getTemplate('<fragment>').then((nodes) => {
            let stream = new StringifierStream();
            stream.on('error', (error) => {
                assert(error instanceof Error);
                done();
            });
            stream.end(nodes);
        });
    });

    it('should re-emit errors from fragment streams', (done) => {
        return getTemplate('<fragment>').then((nodes) => {
            let st = new PassThrough();
            let stream = new StringifierStream((tag) => {
                if (tag) {
                    return st;
                }
            });
            stream.on('error', (error) => {
                assert.equal(error.message, 'sorry!');
                done();
            });
            stream.end(nodes);
            st.emit('error', new Error('sorry!'));
            st.end('data');
        });
    });

});
