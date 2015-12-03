'use strict';

const assert = require('assert');
const stream = require('stream');
const BigPipeStream = require('../lib/streams/big-pipe-stream');

describe('Big Pipe Stream', () => {

    it('should join streams in the order of data', (done) => {
        const bigPipe = new BigPipeStream();
        const st1 = new stream.PassThrough();
        const st2 = new stream.PassThrough();
        let data = '';
        bigPipe.write(st1);
        bigPipe.end(st2);
        st2.end('two');
        st1.end('one');
        bigPipe.on('data', (chunk) => {
            data += chunk;
        });
        bigPipe.on('end', () => {
            assert.equal(data, 'twoone');
            done();
        });
    });

    it('should end without streams', (done) => {
        const bigPipe = new BigPipeStream();
        bigPipe.on('data', () => {});
        bigPipe.on('end', () => {
            done();
        });
        bigPipe.end();
    });

});
