'use strict';

const path = require('path');
const url = require('url');
const fs = require('fs');

module.exports = function fetchTemplate (templatesPath, baseTemplate) {
    return (request, parseTemplate) => {
        const pathname = url.parse(request.url, true).pathname;
        const templatePath = path.join(templatesPath, pathname) + '.html';
        let pageTemplate = fs.readFileSync(templatePath, 'utf-8');
        if (!baseTemplate) {
            baseTemplate = pageTemplate;
            pageTemplate = null;
        }
        return Promise.resolve(parseTemplate(baseTemplate, pageTemplate));
    };
};
