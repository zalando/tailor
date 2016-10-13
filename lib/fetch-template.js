'use strict';

const path = require('path');
const url = require('url');
const fs = require('fs');

const TEMPLATE_ERROR = 0;
const TEMPLATE_NOT_FOUND = 1;

class TemplateError extends Error {
    constructor(...args) {
        super(...args);

        let code = TEMPLATE_ERROR;
        if (args.length > 0 && args[0].code === 'ENOENT') {
            code = TEMPLATE_NOT_FOUND;
            this.presentable = 'template not found';
        }

        this.code = code;
    }
}

const readFile = path => {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf-8', (err, data) => {
            if (err) {
                reject(new TemplateError(err));
            }

            resolve(data);
        });
    });
};

module.exports = function fetchTemplate (templatesPath, baseTemplateFn) {
    return (request, parseTemplate) => {
        const pathname = url.parse(request.url, true).pathname;
        const templatePath = path.join(templatesPath, pathname) + '.html';
        return readFile(templatePath)
            .then(baseTemplate => {
                if (typeof baseTemplateFn !== 'function') {
                    return parseTemplate(baseTemplate);
                }

                const templateName = baseTemplateFn(pathname);
                if (!templateName) {
                    return parseTemplate(baseTemplate);
                }

                pageTemplate = baseTemplate;
                const baseTemplatePath = path.join(templatesPath, templateName) + '.html';
                return readFile(baseTemplatePath)
                    .then(baseTemplate => parseTemplate(baseTemplate, pageTemplate));
            });
    };
};

module.exports.TEMPLATE_ERROR = TEMPLATE_ERROR;
module.exports.TEMPLATE_NOT_FOUND = TEMPLATE_NOT_FOUND;
