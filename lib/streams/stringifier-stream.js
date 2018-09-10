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
            this.isBusy = true;

            /**
             * Since streams are consumed in parallel and processed in series,
             * We use the endEmitted flag on the stream to know if the stream has ended
             * before we even register the 'end' event
             */
            if (st._readableState && st._readableState.endEmitted) {
                this.onEnd(st);
            } else {
                st.on('end', () => this.onEnd(st));
            }
        } else {
            this.push(st);
            this.next();
        }
    }

    onEnd(st) {
        this.push(Buffer.concat(st.buffer));
        this.cleanup(st);
        this.processNext();
    }

    processNext() {
        this.isBusy = false;
        this.next();
    }

    cleanup(st) {
        st.buffer = [];
        st.removeListener('end', () => this.onEnd(st));
        st.removeListener('error', err => this.onError(err, st));
        st.setMaxListeners(st.getMaxListeners() - 1);
    }

    onError(err, st) {
        this.emit('error', err);
        this.cleanup(st);
        this.processNext();
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
                st.buffer = [];
                const onData = data => st.buffer.push(data);

                st.setMaxListeners(st.getMaxListeners() + 1);
                st.on('data', onData);
                st.on('error', err => this.onError(err, st));
            }
            // Process streams in series
            this.queue.push(st);
        }
        this.next();
        done();
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
