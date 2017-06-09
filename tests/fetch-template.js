'use strict';
const fetchTemplate = require('../lib/fetch-template');
const assert = require('assert');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');

describe('fetch-template', () => {
    const mockParseTemplate = sinon.spy();
    let mockRequest;
    const templatePath = path.join(__dirname);
    const testTemplatePath = `${templatePath}/test.html`;
    const baseTemplatePath = `${templatePath}/base-template.html`;

    beforeEach(() => {
        fs.writeFileSync(testTemplatePath, '<div>test</div>');
        fs.writeFileSync(baseTemplatePath, '<div>base-template</div>');
    });

    afterEach(() => {
        if (fs.existsSync(testTemplatePath)) {
            fs.unlinkSync(testTemplatePath);
        }

        if (fs.existsSync(baseTemplatePath)) {
            fs.unlinkSync(baseTemplatePath);
        }
    });

    it('should be able to fetch the static template with absolute path', () => {
        mockRequest = {
            url: 'http://localhost:8080/test'
        };

        return fetchTemplate(templatePath)(mockRequest, mockParseTemplate)
            .then(() => {
                assert(mockParseTemplate.calledOnce);
                return assert(mockParseTemplate.calledWith('<div>test</div>'));
            });
    });

    it('should be able to fetch template with relative path and baseTemplateFn', () => {
        mockRequest = {
            url: 'http://localhost:8080/test'
        };
        const baseTemplateFn = () => 'base-template';

        return fetchTemplate(templatePath, baseTemplateFn)(mockRequest, mockParseTemplate)
            .then(() => {
                assert(mockParseTemplate.called);
                return assert(mockParseTemplate.calledWith(
                    '<div>base-template</div>',
                    '<div>test</div>'
                ));
            });
    });

    it('should throw TEMPLATE_NOT_FOUND error for not present template', () => {
        mockRequest = {
            url: 'http://localhost:8080/test'
        };

        return fetchTemplate('templates')(mockRequest, mockParseTemplate)
            .catch(err => {
                assert(err.code, 1);
                assert(err.presentable, 'template not found');
            });
    });
});
