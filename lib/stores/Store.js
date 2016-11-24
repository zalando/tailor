'use strict';

module.exports = class Store {
    get() {
        throw new Error('Method get not implemented');
    }
    set() {
        throw new Error('Method set not implemented');
    }
    destroy() {
        throw new Error('Method destroy not implemented');
    }
    touch() {
        // to extend ttl
        throw new Error('Method touch not implemented');
    }
};
