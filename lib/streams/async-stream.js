'use strict';

const stream = require('stream');

module.exports = class BigPipeStream extends stream.Transform {

    constructor () {
        super({objectMode: true});
        this.streams = 0;
    }

    _transform (st, encoding, done) {
        let data = new Buffer([]);
        this.streams += 1;
        st.on('data', (chunk) => {
            data = Buffer.concat([data, chunk]);
        });
        st.on('end', () => {
            this.streams -= 1;
            this.push(data);
            if (this.streams === 0) {
                this.emit('alldone');
            }
        });
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
