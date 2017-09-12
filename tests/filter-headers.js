'use strict';
const filterHeaders = require('../lib/filter-headers');
const assert = require('assert');

describe('filter-headers', () => {
    const headers = {
        'please-kill-me': '0',
        'accept-language': '1',
        referer: '2',
        'user-agent': '3'
    };

    it('keeps only certain headers', () => {
        const after = {
            'accept-language': '1',
            referer: '2',
            'user-agent': '3'
        };
        assert.deepEqual(filterHeaders({}, { headers }), after);
    });

    it('removes headers if fragment is public', () => {
        assert.deepEqual(filterHeaders({ public: true }, { headers }), {});
    });
});
