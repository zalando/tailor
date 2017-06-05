'use strict';
const assert = require('assert');
const ContentLengthStream = require('../../lib/streams/content-length-stream');
const Transform = require('stream').Transform;

describe('ContentLengthStream', () => {

    it('calculates content length and calls callback with the result', (done) => {
        const st = new ContentLengthStream((contentLength) => {
            assert(contentLength, 'foobar'.length);
            done();
        });
        st.write(Buffer.from('foo'));
        st.end(Buffer.from('bar'));
    });

    it('is a Transform stream', () => {
        const st = new ContentLengthStream(() => {});
        assert(st instanceof Transform);
    });

    it('passes through data chunks', (done) => {
        const chunk = Buffer.from('foo');
        const st = new ContentLengthStream(() => {});
        st.on('data', (data) => {
            assert.equal(data, chunk);
            done();
        });
        st.write(chunk);
    });

});
