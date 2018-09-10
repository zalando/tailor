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
    function getRandomDelay() {
        const max = 30;
        const min = 0;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function writeDelayedDataToStream(data, stream) {
        const chunks = data.split(' ');
        setTimeout(() => scheduleChunk(chunks, stream, 0), getRandomDelay());
    }

    function scheduleChunk(chunks, stream, index) {
        if (index === chunks.length - 1) {
            stream.end(chunks[index]);
            return;
        } else {
            stream.write(chunks[index]);
        }

        setTimeout(
            () => scheduleChunk(chunks, stream, index + 1),
            getRandomDelay()
        );
    }

    it('should stream the content from a fragment tag', done => {
        let st = new PassThrough();
        const templatePromise = getTemplate(
            '<fragment title="mock"></fragment>'
        );
        templatePromise.then(nodes => {
            let data = '';
            const stream = new StringifierStream(tag => {
                if (tag && tag.name) {
                    assert.deepEqual(tag.attributes, { title: 'mock' });
                    return st;
                }
                return '';
            });
            stream.on('data', chunk => {
                data += chunk;
            });
            stream.on('end', () => {
                assert.equal(
                    data,
                    '<html><head></head><body>mock</body></html>'
                );
                done();
            });
            nodes.forEach(node => stream.write(node));
            stream.end();
            st.end('mock');
        });
    });

    it('should consume stream asynchronously', done => {
        const templatePromise = getTemplate(
            '<fragment id="1"></fragment><fragment id="2"></fragment><fragment id="3"></fragment>'
        );
        templatePromise.then(nodes => {
            let data = '';
            let streams = [
                new PassThrough(),
                new PassThrough(),
                new PassThrough()
            ];
            const stream = new StringifierStream(tag => {
                if (tag && tag.name) {
                    return streams[tag.attributes.id - 1];
                }
                return '';
            });
            stream.on('data', chunk => {
                data += chunk;
            });
            stream.on('end', () => {
                assert.equal(
                    data,
                    '<html><head></head><body>123</body></html>'
                );
                done();
            });
            nodes.forEach(node => stream.write(node));
            stream.end();
            setTimeout(() => {
                streams[0].end('1');
            }, 10);

            setTimeout(() => {
                streams[1].end('2');
            }, 5);

            streams[2].end('3');
        });
    });

    it('should flush the streams to the client in declared order', done => {
        const templatePromise = getTemplate(
            '<fragment id="1"></fragment><fragment id="2"></fragment><fragment id="3"></fragment>'
        );

        templatePromise.then(nodes => {
            let data = '';
            let streams = [
                new PassThrough(),
                new PassThrough(),
                new PassThrough({ objectMode: true })
            ];
            const stream = new StringifierStream(tag => {
                if (tag && tag.name) {
                    return streams[tag.attributes.id - 1];
                }
                return '';
            });
            stream.on('data', chunk => {
                data += chunk;
            });
            stream.on('end', () => {
                assert.equal(
                    data,
                    '<html><head></head><body>DatafromS1DatafromS2DatafromS3</body></html>'
                );
                done();
            });
            nodes.forEach(node => stream.write(node));
            stream.end();

            writeDelayedDataToStream('Data from S1', streams[0]);
            writeDelayedDataToStream('Data from S2', streams[1]);
            writeDelayedDataToStream('Data from S3', streams[2]);
        });
    });

    it('should emit an error if a fragment is not handled', done => {
        getTemplate('<fragment>').then(nodes => {
            let stream = new StringifierStream();
            stream.on('error', error => {
                assert(error instanceof Error);
                done();
            });
            nodes.forEach(node => stream.write(node));
            stream.end();
        });
    });

    it('should re-emit errors from fragment streams', done => {
        getTemplate('<fragment>').then(nodes => {
            let st = new PassThrough();
            let stream = new StringifierStream(tag => {
                if (tag.name === 'fragment') {
                    return st;
                }
            });
            stream.on('error', error => {
                assert.equal(error.message, 'sorry!');
                done();
            });
            nodes.forEach(node => stream.write(node));
            stream.end();
            st.emit('error', new Error('sorry!'));
            st.end('data');
        });
    });
});
