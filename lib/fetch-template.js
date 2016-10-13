'use strict';

const path = require('path');
const url = require('url');
const fs = require('fs');

const TEMPLATE_NOT_FOUND = 1;

const fsError = (err) => {
    if (err.code === 'ENOENT') {
        return {code: TEMPLATE_NOT_FOUND, original: err};
    }

    return err;
};

const readFile = path => {
    return new Promise((resolve, reject) => {
        fs.readFileSync(path, 'utf-8', (err, data) => {
            if (err) {
                reject(fsError(err));
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
                    .then(baseTemplate => {
                        return parseTemplate(baseTemplate, pageTemplate);
                    });
            });
    };
};
