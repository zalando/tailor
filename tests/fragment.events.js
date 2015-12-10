'use strict';
const Fragment = require('../lib/fragment');
const assert = require('assert');
const nock = require('nock');
const TAG = {attributes: {src: 'https://fragment'}};
const HEADERS = {};
const RESPONSE_HEADERS = {connection: 'close'};
const sinon = require('sinon');

describe('Fragment events', () => {

    it('triggers `start` event', (done) => {
        nock('https://fragment').get('/').reply(200, 'OK');
        const fragment = new Fragment(TAG, {}, false);
        fragment.on('start', done);
        fragment.fetch(HEADERS);
    });

    it('triggers `response(statusCode, headers)` when received headers', (done) => {
        nock('https://fragment').get('/').reply(200, 'OK', RESPONSE_HEADERS);
        const fragment = new Fragment(TAG, {}, false);
        fragment.on('response', (statusCode, headers) => {
            assert.equal(statusCode, 200);
            assert.deepEqual(headers, RESPONSE_HEADERS);
            done();
        });
        fragment.fetch(HEADERS);
    });

    it('triggers `end(contentSize)` when the content is succesfully retreived', (done) => {
        nock('https://fragment').get('/').reply(200, '12345');
        const fragment = new Fragment(TAG, {}, false);
        fragment.on('end', (contentSize) => {
            assert.equal(contentSize, 5);
            done();
        });
        fragment.fetch(HEADERS);
        fragment.stream.resume();
    });

    it('triggers `error(error)` when fragment responds with 50x', (done) => {
        nock('https://fragment').get('/').reply(500);
        const fragment = new Fragment(TAG, {}, false);
        fragment.on('error', (error) => {
            assert.ok(error);
            done();
        });
        fragment.fetch(HEADERS);
    });

    it('should not trigger `response` and `end` if there was an `error`', (done) => {
        const onResponse = sinon.spy();
        const onEnd = sinon.spy();
        const onError = sinon.spy();
        nock('https://fragment').get('/').reply(500);
        const fragment = new Fragment(TAG, {}, false);
        fragment.on('response', onResponse);
        fragment.on('end', onEnd);
        fragment.on('error', onError);
        fragment.fetch(HEADERS);
        fragment.stream.on('end', () => {
            assert.equal(onResponse.callCount, 0);
            assert.equal(onEnd.callCount, 0);
            assert.equal(onError.callCount, 1);
            done();
        });
        fragment.stream.resume();
    });

    it('triggers `error(error)` when there is socket error', (done) => {
        const ERROR = {
            message: 'something awful happened',
            code: 'AWFUL_ERROR'
        };
        nock('https://fragment')
            .get('/')
            .replyWithError(ERROR);
        const fragment = new Fragment(TAG, {}, false);
        fragment.on('error', (error) => {
            assert.equal(error.message, ERROR.message);
            done();
        });
        fragment.fetch(HEADERS);
    });

    it('triggers `error(error)` when fragment times out', (done) => {
        nock('https://fragment').get('/').socketDelay(101).reply(200);
        const tag = {attributes: {src: 'https://fragment', timeout: '100'}};
        const fragment = new Fragment(tag, {}, false);
        fragment.on('error', (err) => {
            assert.equal(err.message, 'Request aborted');
            done();
        });
        fragment.fetch(HEADERS);
    });

});
