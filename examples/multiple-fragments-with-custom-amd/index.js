'use strict';
const http = require('http');
const path = require('path');
const Tailor = require('../../index');
const fetchTemplateFs = require('../../lib/fetch-template');
const serveFragment = require('./fragment');
const baseTemplateFn = () => 'base-template';
const AMD_LOADER = 'file://' + require.resolve('iamdee');
const tailor = new Tailor({
    amdLoaderUrl: AMD_LOADER,
    maxAssetLinks: 2,
    fetchTemplate: fetchTemplateFs(path.join(__dirname, 'templates'), baseTemplateFn)
});
const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') {
        res.writeHead(200, { 'Content-Type': 'image/x-icon' } );
        return res.end('');
    }
    return tailor.requestHandler(req, res);
});
server.listen(8080);
console.log('Tailor started at port 8080');
tailor.on('error', (request, err) => console.error(err));

const fragment1 = http.createServer(
    serveFragment('fragment1', 'http://localhost:8081')
);
fragment1.listen(8081);
console.log('Fragment1 started at port 8081');

const fragment2 = http.createServer(
    serveFragment('fragment2', 'http://localhost:8082')
);
fragment2.listen(8082);
console.log('Fragment2 started at port 8082');

const fragment3 = http.createServer(
    serveFragment('fragment3', 'http://localhost:8083', 2)
);
fragment3.listen(8083);
console.log('Fragment3 started at port 8083');
