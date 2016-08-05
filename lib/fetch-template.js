'use strict';

const path = require('path');
const url = require('url');
const fs = require('fs');

module.exports = function fetchTemplate (templatesPath, baseTemplateFn) {
    return (request, parseTemplate) => {
        const pathname = url.parse(request.url, true).pathname;
        const templatePath = path.join(templatesPath, pathname) + '.html';
        let baseTemplate = fs.readFileSync(templatePath, 'utf-8');
        let pageTemplate;
        if (typeof baseTemplateFn === 'function') {
            const templateName = baseTemplateFn(pathname);
            if (templateName) {
                pageTemplate = baseTemplate;
                const baseTemplatePath = path.join(templatesPath, templateName) + '.html';
                baseTemplate = fs.readFileSync(baseTemplatePath, 'utf-8');
            }
        }
        return Promise.resolve(parseTemplate(baseTemplate, pageTemplate));
    };
};
