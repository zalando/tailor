'use strict';

const requestFragment = require('../lib/request-fragment');
const assert = require('assert');
const nock = require('nock');

describe('requestFragment', () => {

    let fragmentAttrb;
    beforeEach( () => {
        fragmentAttrb = {
            timeout: 1000
        };
    });

    it('Should request fragment using http protocol', (done) => {
        nock('http://fragment').get('/').reply(200, 'HTTP');
        requestFragment('http://fragment/', fragmentAttrb, {headers: {}}).then((response) => {
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

    it('Should request fragment using https protocol', (done) => {
        nock('https://fragment').get('/').reply(200, 'HTTPS');
        requestFragment('https://fragment/', fragmentAttrb, {headers: {}}).then((response) => {
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

    it('Should reject promise and respond with error for status code >500', (done) => {
        nock('http://fragment').get('/').reply(500, 'Internal Server Error');
        requestFragment('http://fragment/', fragmentAttrb, {headers: {}}).catch((err) => {
            assert.equal(err.message, 'Internal Server Error');
            done();
        });
    });

    it('Should timeout when the fragment is not reachable', (done) => {
        nock('http://fragment').get('/').socketDelay(1001).reply(200, 'hello');
        requestFragment('http://fragment/', fragmentAttrb, {headers: {}}).catch((err) => {
            assert.equal(err.message, 'Request aborted');
            done();
        });

    });

});
