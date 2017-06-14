'use strict';
const { request: filterRequestHeaders, response: filterResponseHeaders } = require('../lib/filter-headers');
const assert = require('assert');


describe('filter-headers', () => {

    describe('request', () => {
        const headers = {
            'please-kill-me': '0',
            'accept-language': '1',
            'referer': '2',
            'user-agent': '3'
        };

        it('keeps only certain headers', () => {
            const after = { 'accept-language': '1', 'referer': '2', 'user-agent': '3' };
            assert.deepEqual(filterRequestHeaders({}, { headers }), after);
        });

        it('removes headers if fragment is public', () => {
            assert.deepEqual(filterRequestHeaders({ public: true }, { headers }), {});
        });
    });

    describe('request', () => {
        const headers = {
            'please-kill-me': '0',
            'location': '1',
            'set-cookie': '2'
        };

        it('keeps only certain headers', () => {
            const after = { 'location': '1', 'set-cookie': '2' };
            assert.deepEqual(filterResponseHeaders({}, { headers }), after);
        });

        it('removes headers if fragment is public', () => {
            assert.deepEqual(filterResponseHeaders({ public: true }, { headers }), {});
        });
    });
});
