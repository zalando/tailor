'use strict';

const path = require('path');
const url = require('url');
const fs = require('fs');

module.exports = function fetchTemplate (templatesPath) {
    return (request, parseTemplate) => {
        const pathname = url.parse(request.url, true).pathname;
        const templatePath = path.join(templatesPath, pathname) + '.html';
        return Promise.resolve(parseTemplate(fs.createReadStream(templatePath)));
    };
};
