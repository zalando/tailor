'use strict';

const Store = require('./store');

module.exports = class MemoryStore extends Store {
    constructor() {
        super();
        this.state = {};
        this.locked = false;
    }
    get(key) {
        if (this.locked) {
            return Promise.reject(new Error('Cannot retrieve from a locked Store'));
        }
        if (hop(this.state, key)) {
            return Promise.resolve(this.state[key]);
        }
        return Promise.reject(new Error(`key ${key} not found in MemoryStore`));
    }
    set(key, value) {
        if (this.locked) {
            return Promise.reject(new Error('Cannot mutate a locked Store'));
        }
        this.state[key] = value;
        return Promise.resolve();
    }
    destroy(key) {
        if (this.locked) {
            return Promise.reject(new Error('Cannot destroy something in a locked Store'));
        }
        delete this.state[key];
        return Promise.resolve();
    }
    lock(p = Promise.resolve()) {
        this.locked = true;
        p.then(() => {
            this.locked = false;
        });
    }
};

function hop(o, key) {
    return Object.hasOwnProperty.call(o, key);
}
