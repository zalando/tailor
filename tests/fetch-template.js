'use strict';
const fetchTemplate = require('../lib/fetch-template');
const assert = require('assert');
const sinon = require('sinon');

describe('fetch-template', () => {
    const mockParseTemplate = sinon.spy();
    let mockRequest;

    it('should be able to fetch the static template with absolute path', () => {
        mockRequest = {
            url: 'http://localhost:8080/test'
        };

        fetchTemplate('mock-templates')(mockRequest, mockParseTemplate)
            .then(() => {
                assert(mockParseTemplate.calledOnce);
                return assert(mockParseTemplate.calledWith(
                    Buffer.from('<div>test</div>')
                ));
            });
    });

    it('should be able to fetch template with relative path and baseTemplateFn', () => {
        mockRequest = {
            url: 'http://localhost:8080/base-template'
        };
        const baseTemplateFn = () => 'base-template';

        fetchTemplate('mock-templates', baseTemplateFn)(mockRequest, mockParseTemplate)
            .then(() => {
                assert(mockParseTemplate.calledOnce);
                return assert(mockParseTemplate.calledWith(
                    Buffer.from('<div>base-template</div>')
                ));
            });
    });

    it('should throw TEMPLATE_NOT_FOUND error for not present template', () => {
        mockRequest = {
            url: 'http://localhost:8080/test'
        };

        fetchTemplate('templates')(mockRequest, mockParseTemplate)
            .catch(err => {
                assert(err.code, 1);
                assert(err.presentable, 'template not found');
            });
    });
});