'use strict';
const stream = require('stream');
const AsyncStream = require('./async-stream');

module.exports = class StringifierStream extends stream.Transform {
    constructor(fn) {
        super({ objectMode: true });
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
            if (st instanceof AsyncStream) {
                st.emit('plugged');
            }
            st.setMaxListeners(st.getMaxListeners() + 1);
            this.isBusy = true;
        } else {
            this.push(st);
            this.next();
        }
    }

    _transform(chunk, encoding, done) {
        if (chunk instanceof Buffer) {
            this.queue.push(chunk);
        } else if (typeof this.fn !== 'function') {
            if (chunk.name) {
                this.emit(
                    'error',
                    new Error('Please provide transform function')
                );
            }
        } else {
            const st = this.fn(chunk);
            // Consume streams in parallel
            if (st instanceof stream) {
                st.memoryBuffer = [];
                const onData = data => st.memoryBuffer.push(data);

                st.on('data', onData);
                st.on('end', () => this.onEnd(st));
                st.on('error', err => this.onError(err, st));
            }
            // Process streams in order
            this.queue.push(st);
        }
        this.next();
        done();
    }

    onEnd(st) {
        this.push(Buffer.concat(st.memoryBuffer));
        this.cleanup(st);
        this.processNext();
    }

    processNext() {
        this.isBusy = false;
        this.next();
    }

    cleanup(st) {
        st.memoryBuffer = [];
        st.removeListener('end', this.onEnd);
        st.removeListener('error', this.onError);
        st.setMaxListeners(st.getMaxListeners() - 1);
    }

    onError(err, st) {
        this.emit('error', err);
        this.cleanup(st);
    }

    _flush(done) {
        this.isFinished = true;
        if (this.queue.length === 0 && !this.isBusy) {
            done();
        } else {
            this.on('alldone', done);
        }
    }
};
