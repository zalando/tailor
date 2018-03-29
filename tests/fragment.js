'use strict';

const Fragment = require('../lib/fragment');
const assert = require('assert');
const getOptions = tag => {
    return {
        tag,
        context: {},
        index: false,
        requestFragment: () => {}
    };
};

describe('Fragment', () => {
    it('computed and custom attributes are correctly initiliazed', () => {
        const attributes = {
            id: 'foo',
            src: 'https://fragment',
            'fallback-src': 'https://fragment-fallback',
            async: true,
            timeout: '4000',
            custom: 'bar'
        };

        const expected = {
            id: attributes.id,
            url: attributes.src,
            'fallback-src': attributes['fallback-src'],
            src: attributes.src,
            fallbackUrl: attributes['fallback-src'],
            async: attributes.async,
            timeout: 4000,
            primary: false,
            lazy: false,
            public: false,
            custom: attributes.custom
        };

        const tag = { attributes };
        const fragment = new Fragment(getOptions(tag));
        const fattributes = fragment.attributes;

        assert.deepEqual(fattributes, expected);
    });
});
