'use strict';

const Fragment = require('../lib/fragment');
const assert = require('assert');
const getOptions = tag => {
    return {
        tag,
        context: {},
        index: false,
        requestFragment: () => {},
        defaultAttributes: {
            'fallback-src': 'https://default-fragment-fallback',
            custom: 'default-bar'
        }
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
            public: false,
            custom: attributes.custom
        };

        const tag = { attributes };
        const fragment = new Fragment(getOptions(tag));
        const fattributes = fragment.attributes;

        assert.deepEqual(fattributes, expected);
    });

    it('should fall back to default attribute values if present and value is not set', () => {
        const attributes = {
            id: 'foo',
            src: 'https://fragment',
            async: true,
            timeout: '4000'
        };

        const tag = { attributes };
        const options = getOptions(tag);

        const { defaultAttributes } = options;

        const expected = {
            id: attributes.id,
            url: attributes.src,
            'fallback-src': defaultAttributes['fallback-src'],
            src: attributes.src,
            fallbackUrl: defaultAttributes['fallback-src'],
            async: attributes.async,
            timeout: 4000,
            primary: false,
            public: false,
            custom: defaultAttributes.custom
        };

        const fragment = new Fragment(options);
        const fattributes = fragment.attributes;

        assert.deepEqual(fattributes, expected);
    });
});
