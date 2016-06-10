'use strict';
const Fragment = require('../lib/fragment');
const assert = require('assert');
const nock = require('nock');
const TAG = {attributes: {src: 'https://fragment'}};
const TAG_FALLBACK = {attributes: {src: 'https://fragment', 'fallback_src': 'https://fallback-fragment'}};
const REQUEST = {
    headers: {}
};
const RESPONSE_HEADERS = {connection: 'close'};
const sinon = require('sinon');
const requestFragment = require('../lib/request-fragment');

describe('Fragment events', () => {

    it('triggers `start` event', (done) => {
        nock('https://fragment').get('/').reply(200, 'OK');
        const fragment = new Fragment(TAG, {}, false, requestFragment);
        fragment.on('start', done);
        fragment.fetch(REQUEST, false);
    });

    it('triggers `fallback` event', (done) => {
        nock('https://fragment').get('/').reply(500, 'Server Error');
        nock('https://fallback-fragment').get('/').reply(200, 'OK');
        const fragment = new Fragment(TAG_FALLBACK, {}, false, requestFragment);
        fragment.on('fallback', () => {
            done();
        });
        fragment.fetch(REQUEST, false);
    });

    it('should not trigger error and response event when fallback is triggered', (done) => {
        const onFallback = sinon.spy();
        const onError = sinon.spy();

        nock('https://fragment').get('/').reply(500, 'Server Error');
        nock('https://fallback-fragment').get('/').reply(200);
        const fragment = new Fragment(TAG_FALLBACK, {}, false, requestFragment);
        fragment.on('fallback',onFallback);
        fragment.on('error', onError);
        fragment.stream.on('end', () => {
            assert.equal(onFallback.callCount, 1);
            assert.equal(onError.callCount, 0);
            done();
        });
        fragment.fetch(REQUEST, false);
        fragment.stream.resume();
    });

    it('triggers `response(statusCode, headers)` when received headers', (done) => {
        nock('https://fragment').get('/').reply(200, 'OK', RESPONSE_HEADERS);
        const fragment = new Fragment(TAG, {}, false, requestFragment);
        fragment.on('response', (statusCode, headers) => {
            assert.equal(statusCode, 200);
            assert.deepEqual(headers, RESPONSE_HEADERS);
            done();
        });
        fragment.fetch(REQUEST, false);
    });

    it('triggers `end(contentSize)` when the content is succesfully retreived', (done) => {
        nock('https://fragment').get('/').reply(200, '12345');
        const fragment = new Fragment(TAG, {}, false, requestFragment);
        fragment.on('end', (contentSize) => {
            assert.equal(contentSize, 5);
            done();
        });
        fragment.fetch(REQUEST, false);
        fragment.stream.resume();
    });

    it('triggers `error(error)` when fragment responds with 50x', (done) => {
        nock('https://fragment').get('/').reply(500);
        const fragment = new Fragment(TAG, {}, false, requestFragment);
        fragment.on('error', (error) => {
            assert.ok(error);
            done();
        });
        fragment.fetch(REQUEST, false);
    });

    it('should not trigger `response` and `end` for fallback fragment', (done) => {
        const onResponse = sinon.spy();
        const onEnd = sinon.spy();
        const onFallback = sinon.spy();
        nock('https://fragment').get('/').reply(500);
        const fragment = new Fragment(TAG_FALLBACK, {}, false, requestFragment);
        fragment.on('response', onResponse);
        fragment.on('end', onEnd);
        fragment.on('fallback', onFallback);
        fragment.fetch(REQUEST, false);
        fragment.stream.on('end', () => {
            assert.equal(onResponse.callCount, 0);
            assert.equal(onEnd.callCount, 0);
            assert.equal(onFallback.callCount, 1);
            done();
        });
        fragment.stream.resume();
    });

    it('should not trigger `response` and `end` if there was an `error`', (done) => {
        const onResponse = sinon.spy();
        const onEnd = sinon.spy();
        const onError = sinon.spy();
        nock('https://fragment').get('/').reply(500);
        const fragment = new Fragment(TAG, {}, false, requestFragment);
        fragment.on('response', onResponse);
        fragment.on('end', onEnd);
        fragment.on('error', onError);
        fragment.fetch(REQUEST, false);
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
        const fragment = new Fragment(TAG, {}, false, requestFragment);
        fragment.on('error', (error) => {
            assert.equal(error.message, ERROR.message);
            done();
        });
        fragment.fetch(REQUEST, false);
    });

    it('triggers `error(error)` when fragment times out', (done) => {
        nock('https://fragment').get('/').socketDelay(101).reply(200);
        const tag = {attributes: {src: 'https://fragment', timeout: '100'}};
        const fragment = new Fragment(tag, {}, false, requestFragment);
        fragment.on('error', (err) => {
            assert.equal(err.message, 'Request aborted');
            done();
        });
        fragment.fetch(REQUEST, false);
    });

});
