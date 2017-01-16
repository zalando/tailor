'use strict';

const assert = require('assert');
const http = require('http');
const nock = require('nock');
const sinon = require('sinon');
const Tailor = require('../index');

describe('Tailor events', () => {

    let server;
    let tailor;
    const mockTemplate = sinon.stub();
    const mockContext = sinon.stub();

    beforeEach((done) => {
        tailor = new Tailor({
            fetchContext: mockContext,
            pipeDefinition: () => new Buffer(''),
            fetchTemplate: (request, parseTemplate) => {
                const template = mockTemplate(request);
                if (template) {
                    return parseTemplate(template);
                } else {
                    return Promise.reject('Error fetching template');
                }
            }
        });
        mockContext.returns(Promise.resolve({}));
        server = http.createServer(tailor.requestHandler);
        server.listen(8080, 'localhost', done);
    });

    afterEach((done) => {
        mockContext.reset();
        mockTemplate.reset();
        server.close(done);
    });

    it('forwards `fragment:start(request, fragment)` event from a fragment', (done) => {
        const onFragmentStart = sinon.spy();
        nock('https://fragment').get('/').reply(200, 'hello');
        mockTemplate.returns('<fragment src="https://fragment">');
        tailor.on('fragment:start', onFragmentStart);
        http.get('http://localhost:8080/template', (response) => {
            const request = onFragmentStart.args[0][0];
            const fragment = onFragmentStart.args[0][1];
            assert.equal(request.url, '/template');
            assert.equal(fragment.url, 'https://fragment');
            response.resume();
            response.on('end', done);
        });
    });

    it('emits `start(request)` event', (done) => {
        const onStart = sinon.spy();
        nock('https://fragment').get('/').reply(200, 'hello');
        mockTemplate.returns('<fragment src="https://fragment">');
        tailor.on('start', onStart);
        http.get('http://localhost:8080/template', (response) => {
            response.resume();
            response.on('end', () => {
                const request = onStart.args[0][0];
                assert.equal(request.url, '/template');
                assert.equal(onStart.callCount, 1);
                done();
            });
        });
    });

    it('emits `response(request, statusCode, headers)` event', (done) => {
        const onResponse = sinon.spy();
        mockTemplate.returns('<html>');
        tailor.on('response', onResponse);
        http.get('http://localhost:8080/template', (response) => {
            response.resume();
            response.on('end', () => {
                const request = onResponse.args[0][0];
                const statusCode = onResponse.args[0][1];
                const headers = onResponse.args[0][2];
                assert.equal(request.url, '/template');
                assert.equal(statusCode, 200);
                assert.deepEqual(headers, {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Content-Type': 'text/html',
                    'Pragma': 'no-cache'
                });
                assert.equal(onResponse.callCount, 1);
                done();
            });
        });
    });

    it('emits `end(request, contentSize)` event', (done) => {
        const onEnd = sinon.spy();
        mockTemplate.returns('<html><head></head><body><h2></h2></body></html>');
        tailor.on('end', onEnd);
        http.get('http://localhost:8080/template', (response) => {
            response.resume();
            response.on('end', () => {
                const request = onEnd.args[0][0];
                const contentSize = onEnd.args[0][1];
                assert.equal(request.url, '/template');
                assert.equal(contentSize, 48);
                assert.equal(onEnd.callCount, 1);
                done();
            });
        });
    });

    it('emits `error(request, error)` event on primary error/timeout', (done) => {
        const onPrimaryError = sinon.spy();
        nock('https://fragment').get('/').reply(500);
        mockTemplate.returns('<fragment primary src="https://fragment">');
        tailor.on('error', onPrimaryError);
        http.get('http://localhost:8080/template', (response) => {
            const request = onPrimaryError.args[0][0];
            const error = onPrimaryError.args[0][1];
            assert.equal(request.url, '/template');
            assert.equal(error.message, 'Internal Server Error');
            response.resume();
            response.on('end', done);
        });
    });

    it('emits `error(request, error)` event on template error', (done) => {
        const onTemplateError = sinon.spy();
        mockTemplate.returns(false);
        tailor.on('error', onTemplateError);
        http.get('http://localhost:8080/template', (response) => {
            const request = onTemplateError.args[0][0];
            const error = onTemplateError.args[0][1];
            assert.equal(request.url, '/template');
            assert.equal(error, 'Error fetching template');
            response.resume();
            response.on('end', done);
        });
    });

    it('emits `context:error(request, error)` event', (done) => {
        const onContextError = sinon.spy();
        const rejectPrm = Promise.reject('Error fetching context');
        rejectPrm.catch(() => {});
        mockContext.returns(rejectPrm);
        tailor.on('context:error', onContextError);
        http.get('http://localhost:8080/template', (response) => {
            const request = onContextError.args[0][0];
            const error = onContextError.args[0][1];
            assert.equal(request.url, '/template');
            assert.equal(error, 'Error fetching context');
            response.resume();
            response.on('end', done);
        });
    });

});
