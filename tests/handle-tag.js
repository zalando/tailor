'use strict';

const assert = require('assert');
const http = require('http');
const sinon = require('sinon');
const Tailor = require('../index');
const PassThrough = require('stream').PassThrough;

describe('Tailor events', () => {

    let server;
    let tailor;
    const mockTemplate = sinon.stub();
    const mockHandleTag = sinon.stub();

    beforeEach((done) => {
        tailor = new Tailor({
            fetchTemplate: (request, parseTemplate) => {
                const template = mockTemplate(request);
                if (template) {
                    return parseTemplate(template);
                } else {
                    return Promise.reject('Error fetching template');
                }
            },
            handledTags: ['x-tag'],
            handleTag: mockHandleTag
        });
        server = http.createServer(tailor.requestHandler);
        server.listen(8080, 'localhost', done);
    });

    afterEach((done) => {
        mockTemplate.reset();
        mockHandleTag.reset();
        server.close(done);
    });

    it('calls handleTag for a tag in handledTags', (done) => {
        mockTemplate.returns('<x-tag foo="bar"><strong>test</strong></x-tag>');
        mockHandleTag.returns('');
        http.get('http://localhost:8080/template', (response) => {
            const request = mockHandleTag.args[0][0];
            const openTag = mockHandleTag.args[0][1];
            const closeTag = mockHandleTag.args[1][1];
            assert.equal(request.url, '/template');
            assert.deepEqual(openTag, {
                name: 'x-tag',
                attributes: {
                    foo: 'bar'
                },
                isSelfClosing: false
            });
            assert.deepEqual(closeTag, {
                closingTag: 'x-tag',
                attributes: {}
            });
            response.resume();
            response.on('end', done);
        });
    });

    it('replaces the original tag with stream or string content', (done) => {
        const st = new PassThrough();
        mockTemplate.returns('<x-tag foo="bar"><strong>test</strong></x-tag>');
        mockHandleTag.onCall(0).returns(st);
        mockHandleTag.onCall(1).returns('</foo>');
        http.get('http://localhost:8080/template', (response) => {
            let data = '';
            response.on('data', (chunk) => data += chunk);
            response.on('end', () => {
                assert.equal(data, '<foo><strong>test</strong></foo>');
                done();
            });
        });
        st.write('<fo');
        st.end('o>');
    });

});
