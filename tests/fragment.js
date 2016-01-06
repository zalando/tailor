'use strict';
const Fragment = require('../lib/fragment');
const assert = require('assert');

describe('Fragment', () => {
    it('should be able to override async at construction time', () => {
        const attributes = {
            id: 'test',
            async: '',
            src: 'http://example.org'
        };
        const tag = {
            name: 'test',
            attributes: attributes
        };
        const f = new Fragment(tag, {}, true);

        assert.equal(f.attributes.async, false);
    });
});
