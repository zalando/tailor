'use strict';

const requestFragment = require('../lib/request-fragment');
const assert = require('assert');
const nock = require('nock');

describe('requestFragment', () => {

    const fragmentAttrb = {
        primary: true,
        timeout: 1000,
        url: 'http://fragment/'
    };

    it('Should request fragment using http protocol', (done) => {
        nock('http://fragment').get('/').reply(200, 'HTTP');
        requestFragment(fragmentAttrb, {}).then((response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk.toString();
            });
            response.on('end', () => {
                assert.equal(data, 'HTTP');
                done();
            });
        });
    });

    it('Should request fragment using https protocol', () => {
        nock('https://fragment').get('/').reply(200, 'HTTPS');
        fragmentAttrb.url = 'https://fragment/';
        requestFragment(fragmentAttrb, {}).then((response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk.toString();
            });
            response.on('end', () => {
                assert.equal(data, 'HTTPS');
                done();
            });
        });
    });

    it('Should timeout when the fragment is not reachable', (done) => {
        nock('https://fragment').get('/').socketDelay(5000).reply(200, 'hello');
        requestFragment(fragmentAttrb, {}).catch((err) => {
            assert.equal(err.message, 'Request aborted');
            done();
        });

    });

});
