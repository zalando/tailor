'use strict';

const assert = require('assert');
const nock = require('nock');
const filterHeaderFn = () => ({});
const requestFragment = require('../lib/request-fragment')(filterHeaderFn);

describe('requestFragment', () => {
    let fragmentAttrb;
    beforeEach(() => {
        fragmentAttrb = {
            timeout: 1000
        };
    });

    it('Should request fragment using http protocol', done => {
        nock('http://fragment')
            .get('/')
            .reply(200, 'HTTP');
        requestFragment('http://fragment/', fragmentAttrb, {
            headers: {}
        }).then(response => {
            const chunks = [];
            response.on('data', chunk => {
                chunks.push(chunk);
            });
            response.on('end', () => {
                const data = Buffer.concat(chunks).toString('utf8');
                assert.equal(data, 'HTTP');
                done();
            });
        });
    });

    it('Should request fragment using https protocol', done => {
        nock('https://fragment')
            .get('/')
            .reply(200, 'HTTPS');
        requestFragment('https://fragment/', fragmentAttrb, {
            headers: {}
        }).then(response => {
            let chunks = [];
            response.on('data', chunk => {
                chunks.push(chunk);
            });
            response.on('end', () => {
                const data = Buffer.concat(chunks).toString('utf8');
                assert.equal(data, 'HTTPS');
                done();
            });
        });
    });

    it('Should reject promise and respond with error for status code >500', done => {
        nock('http://fragment')
            .get('/')
            .reply(500, 'Internal Server Error');
        requestFragment('http://fragment/', fragmentAttrb, { headers: {} })
            .catch(err => {
                assert.equal(err.message, 'Internal Server Error');
            })
            .then(done, done);
    });

    it('Should timeout when the fragment is not reachable', done => {
        nock('http://fragment')
            .get('/')
            .socketDelay(1001)
            .reply(200, 'hello');
        requestFragment('http://fragment/', fragmentAttrb, { headers: {} })
            .catch(err => {
                assert.equal(err.message, 'socket hang up');
            })
            .then(done, done);
    });
});
