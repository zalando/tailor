'use strict';

const http = require('http');
const PassThrough = require('stream').PassThrough;
const metrics = require('metrics');
const histogram = new metrics.Histogram.createUniformHistogram();
const html = `
    <html>
    <head>
        <meta charset="utf-8">
        <title>Test Page</title>
    </head>
    <body>
        <h2>Fragment 1:</h2>
        <fragment primary src="http://localhost:8081"/>
        <h2>Fragment 2:</h2>
        <fragment async src="http://localhost:8081"/>
    </body>
    </html>
`;
const parseTemplate = require('../lib/parse-template')(['fragment']);
const template = Promise.resolve(html).then(parseTemplate).then(cacheTemplate);
const requests = new WeakMap();
const Tailor = require('../');
const tailor = new Tailor({
    fetchTemplate : () => template.then(unwrapCachedTemplate)
});

function unwrapCachedTemplate (chunks) {
    const stream = new PassThrough({objectMode: true});
    chunks.forEach((chunk) => stream.write(chunk));
    stream.end();
    return stream;
}

function cacheTemplate (stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (data) => chunks.push(data));
        stream.on('end', () => resolve(chunks));
        stream.on('error', (error) => {
            reject(error);
        });
    });
}

// Tailor Events to collect Metrics
tailor.on('start', (request) => {
    requests.set(request, Date.now());
});

tailor.on('end', (request) => {
    if (requests.has(request)) {
        const startTime = requests.get(request);
        const duration = Date.now() - startTime;
        histogram.update(duration);
    }
});

tailor.on('template:error', (request, error) => {
    console.log('Tailor-Template Error', error);
});

tailor.on('primary:error', (request, fragment, error) => {
    console.log('Tailor-Primary Error', error);
});


const server = http.createServer(tailor.requestHandler);

server.listen(8080);

const spawn = require('child_process').spawn;
//Mock fragment server
const fragment = spawn('node' ,['perf/fragment-server.js']);
// Load testing
const worker = spawn('node' ,['perf/loadtest.js']);
worker.stdout.pipe(process.stdout);

worker.on('close', () => {
    console.log('Tailor Metrics', JSON.stringify(histogram.printObj(), null, 2));
    worker.kill();
    fragment.kill();
    process.exit(0);
});
