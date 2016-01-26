'use strict';

const assert = require('assert');
const stream = require('stream');
const AsyncStream = require('../../lib/streams/async-stream');

describe('Async Stream', () => {

    it('should join streams in the order of data', (done) => {
        const asyncStream = new AsyncStream();
        const st1 = new stream.PassThrough();
        const st2 = new stream.PassThrough();
        let data = '';
        asyncStream.write(st1);
        asyncStream.end(st2);
        st2.end('two');
        st1.end('one');
        asyncStream.on('data', (chunk) => {
            data += chunk;
        });
        asyncStream.on('end', () => {
            assert.equal(data, 'twoone');
            done();
        });
    });

    it('should end without streams', (done) => {
        const asyncStream = new AsyncStream();
        asyncStream.on('data', () => {});
        asyncStream.on('end', () => {
            done();
        });
        asyncStream.end();
    });

});
