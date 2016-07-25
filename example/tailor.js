'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const Tailor = require('../index');
const serveFragment = require('./fragment');
const fetchTemplate  = (templatesPath) => {
    return (request, parseTemplate) => {
        const pathname = url.parse(request.url, true).pathname;
        const templatePath = path.join(templatesPath, pathname) + '.html';
        const childTemplate = fs.readFileSync(path.join(__dirname, 'templates/child-template.html'), 'utf-8');
        return Promise.resolve(parseTemplate(fs.readFileSync(templatePath, 'utf-8'), childTemplate));
    };
};

const tailor = new Tailor({
    fetchTemplate: fetchTemplate(path.join(__dirname, 'templates'))
});
const server = http.createServer(tailor.requestHandler);
server.listen(8080);
console.log('Tailor started at port 8080');

const fragment1 = http.createServer(
    serveFragment('hello', 'http://localhost:8081')
);
fragment1.listen(8081);
console.log('Fragment1 started at port 8081');

const fragment2 = http.createServer(
    serveFragment('world', 'http://localhost:8082')
);
fragment2.listen(8082);
console.log('Fragment2 started at port 8082');

const fragment3 = http.createServer(
    serveFragment('body-start', 'http://localhost:8083')
);
fragment3.listen(8083);
console.log('Fragment3 started at port 8083');
