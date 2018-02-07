'use strict';
const http = require('http');
const Tailor = require('../../index');
const serveFragment = require('../multiple-fragments-with-custom-amd/fragment');
const tailor = new Tailor({
    templatesPath: __dirname + '/templates',
    pipeAttributes: attributes => {
        const timingGroups = attributes['timing-group']
            ? attributes['timing-group'].split(',')
            : [];
        const id = attributes.id;
        return { timingGroups, id };
    },
    maxAssetLinks: 3
});
const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') {
        res.writeHead(200, { 'Content-Type': 'image/x-icon' });
        return res.end('');
    }
    return tailor.requestHandler(req, res);
});
server.listen(8080);
console.log('Tailor started at port 8080');
tailor.on('error', (request, err) => console.error(err));

const fragment1 = http.createServer(
    serveFragment('Header', 'http://localhost:8081', 1)
);
fragment1.listen(8081);
console.log('Fragment Header started at port 8081');

const fragment2 = http.createServer(
    serveFragment('Primary', 'http://localhost:8082', 2)
);
fragment2.listen(8082);
console.log('Fragment Primary started at port 8082');

const fragment3 = http.createServer(
    serveFragment('Footer', 'http://localhost:8083', 3, true)
);
fragment3.listen(8083);
console.log('Fragment Footer started at port 8083');
