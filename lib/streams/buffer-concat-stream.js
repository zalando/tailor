'use strict';

const stream = require('stream');

module.exports = class BufferConcatStream extends stream.Writable {

    constructor (callback) {
        super();
        this.data = [];
        this.on('finish', () => {
            callback(Buffer.concat(this.data));
        });
    }

    _write (chunk, encoding, done) {
        this.data.push(chunk);
        done(null, chunk);
    }

};
