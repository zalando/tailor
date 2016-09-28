'use strict';
const http = require('http');
const path = require('path');
const Tailor = require('../index');
const fetchTemplateFs = require('../lib/fetch-template');
const serveFragment = require('./fragment');
const injectRootTemplate = require('../lib/inject-root-template');
const baseTemplateFn = () => 'base-template';

const templatesHandler = fetchTemplateFs(path.join(__dirname, 'templates'), baseTemplateFn);
const templates = injectRootTemplate('index', templatesHandler);

const tailor = new Tailor({
    fetchTemplate: templates
});
const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') {
        res.writeHead(200, {'Content-Type': 'image/x-icon'} );
        return res.end('');
    }
    return tailor.requestHandler(req, res);
});
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
