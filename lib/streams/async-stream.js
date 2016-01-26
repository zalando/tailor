'use strict';

const stream = require('stream');
const BufferConcatStream = require('./buffer-concat-stream');

module.exports = class AsyncStream extends stream.Transform {

    constructor () {
        super({objectMode: true});
        this.streams = 0;
    }

    _transform (st, encoding, done) {
        this.streams += 1;
        st.pipe(new BufferConcatStream ((data) => {
            this.streams -= 1;
            this.push(data);
            if (this.streams === 0) {
                this.emit('alldone');
            }
        }));
        st.on('error', (err) => {
            this.streams -= 1;
            this.emit('error', err);
        });
        done();
    }

    _flush (done) {
        if (this.streams === 0) {
            done();
        } else {
            this.on('alldone', done);
        }
    }

};
