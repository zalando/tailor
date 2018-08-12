'use strict';

const parseLinkHeader = require('../lib/parse-link-header');
const assert = require('assert');

describe('Parse Link Header', () => {
    it('returns uri and rel of the passed header', () => {
        const linkHeader =
            '<http://a.com/app.js>; rel="script",<http://a.com/app.css>; rel="stylesheet"';

        assert.deepStrictEqual(parseLinkHeader(linkHeader), [
            { uri: 'http://a.com/app.js', rel: 'script' },
            { uri: 'http://a.com/app.css', rel: 'stylesheet' }
        ]);
    });

    it('ignore attributes other than rel and uri', () => {
        const linkHeader =
            '<http://a.com/app.js>; rel="script"; crossorigin="anonymous"';

        assert.deepStrictEqual(parseLinkHeader(linkHeader), [
            { uri: 'http://a.com/app.js', rel: 'script' }
        ]);
    });

    it('filters invalid header links', () => {
        const linkHeader = 'http://a.com/app.js; rel="script"';

        assert.deepStrictEqual(parseLinkHeader(linkHeader), []);
    });

    it('filters invalid rel attributes', () => {
        const linkHeader =
            '<http://a.com/app.js>; rel="script";, <http://a.com/app1.css>; rel="stylesheet", <http://a.com/app2.css>;, <http://a.com/app3.css>; rel=""';

        assert.deepStrictEqual(parseLinkHeader(linkHeader), [
            { uri: 'http://a.com/app.js', rel: 'script' },
            { uri: 'http://a.com/app1.css', rel: 'stylesheet' }
        ]);
    });

    it('do not modify query parms in link urls', () => {
        const linkHeader = '<http://a.com/app.js?nocache=1>; rel="script";';

        assert.deepStrictEqual(parseLinkHeader(linkHeader), [
            { uri: 'http://a.com/app.js?nocache=1', rel: 'script' }
        ]);
    });
});
