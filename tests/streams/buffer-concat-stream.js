'use strict';
const assert = require('assert');
const BufferConcatStream = require('../../lib/streams/buffer-concat-stream');

describe('BufferConcatStream', () => {

    it('concats the input and calls the callback with the result', (done) => {
        const st = new BufferConcatStream((result) => {
            assert(result.toString(), 'foobar');
            done();
        });
        st.write(Buffer.from('foo'));
        st.end(Buffer.from('bar'));
    });

});
