'use strict';
const stream = require('stream');

module.exports = class StringifierStream extends stream.Transform {

    constructor(fn) {
        super({objectMode: true});
        this.fn = fn;
        this.queue = [];
        this.isBusy = false;
        this.isFinished = false;
    }

    next() {
        if (this.isBusy) {
            return;
        }
        if (this.queue.length === 0) {
            if (this.isFinished) {
                this.emit('alldone');
            }
            return;
        }
        let st = this.queue.shift();
        if (st instanceof stream) {
            st.setMaxListeners(st.getMaxListeners() + 1);
            this.isBusy = true;

            const onData = (data) => {
                this.push(data);
            };

            const onEnd = () => {
                cleanup();
                this.isBusy = false;
                this.next();
            };

            const onError = (err) => {
                this.emit('error', err);
                onEnd();
            };

            const cleanup = () => {
                st.removeListener('data', onData);
                st.removeListener('end', onEnd);
                st.removeListener('error', onError);
                st.setMaxListeners(st.getMaxListeners() - 1);
            };

            st.on('data', onData);
            st.on('end', onEnd);
            st.on('error', onError);
        } else {
            this.push(st);
            this.next();
        }
    }

    _transform (chunk, encoding, done) {
        if (chunk instanceof Buffer) {
            this.queue.push(chunk);
        } else if (typeof this.fn !== 'function') {
            if (chunk.name) {
                this.emit('error', new Error('Please provide transform function'));
            }
        } else {
            this.queue.push(this.fn(chunk));
        }
        this.next();
        done();
    }

    _flush (done) {
        this.isFinished = true;
        if (this.queue.length === 0 && !this.isBusy) {
            done();
        } else {
            this.on('alldone', done);
        }
    }

};
