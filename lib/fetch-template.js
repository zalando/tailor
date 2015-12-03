'use strict';

const path = require('path');
const url = require('url');
const fs = require('fs');

module.exports = function fetchTemplate (templatesPath) {
    return (request, parseTemplate) => {
        const pathname = url.parse(request.url, true).pathname;
        const templatePath = path.join(templatesPath, pathname) + '.html';
        return new Promise((resolve, reject) => {
            fs.readFile(templatePath, (err) => {
                if (err) {
                    console.log('Error loading', templatePath, 'from fs:', err.toString());
                    reject(err);
                } else {
                    resolve(parseTemplate(fs.createReadStream(templatePath)));
                }
            });
        });
    };
};
