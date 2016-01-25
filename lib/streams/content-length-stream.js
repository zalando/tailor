'use strict';

const stream = require('stream');

module.exports = class ContentLengthStream extends stream.Transform {

    constructor (callback) {
        super();
        this.callback = callback;
        this.contentSize = 0;
    }

    _transform (chunk, encoding, done) {
        this.contentSize += chunk.length;
        done(null, chunk);
    }

    _flush (done) {
        this.callback(this.contentSize);
        done();
    }

};
