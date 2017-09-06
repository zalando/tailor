'use strict';

const http = require('http');
const metrics = require('metrics');
const { spawn } = require('child_process');
const histogram = new metrics.Histogram.createUniformHistogram();
const html = `
    <html>
    <head>
        <meta charset="utf-8">
        <title>Test Page</title>
    </head>
    <body>
        <h2>Fragment 1:</h2>
        <fragment primary src="http://localhost:8081"></fragment>
        <switcher></switcher>
        <h2>Fragment 2:</h2>
        <fragment async src="http://localhost:8081"/></fragment>
    </body>
    </html>
`;
const parseTemplate = require('../lib/parse-template')(['fragment'], []);
const requests = new WeakMap();
const fragments = new WeakMap();
const Tailor = require('../');
const processTemplate = require('../lib/process-template');

const handleTag = (request, tag, options, context) => {
    if (tag && tag.name === 'switcher') {
        const stream = processTemplate(request, options, context);
        process.nextTick(() => {
            stream.end({ name: 'fragment', attributes: { src: 'http://localhost:8081' } });
        });
        return stream;
    }

    return '';
};

const tailor = new Tailor({
    fetchTemplate : () => Promise.resolve(html).then(parseTemplate),
    handleTag,
    handledTags: ['switcher']
});

const getMillisecs = (hrTime) => {
    // [seconds, nanoseconds]
    return hrTime && hrTime[0] * 1e3 + hrTime[1] / 1e6;
};

const updateTailorOverhead = (headersTime, primaryOverhead) => {
    let duration = headersTime - primaryOverhead;
    histogram.update(duration);
};

let primaryOverhead = 0;
// Tailor Events to collect Metrics
tailor.on('start', (request) => {
    requests.set(request, process.hrtime());
});

tailor.on('response', (request) => {
    if (primaryOverhead > 0 && requests.has(request)) {
        const startTime = requests.get(request);
        const timeToHeaders = getMillisecs(process.hrtime(startTime));
        updateTailorOverhead(timeToHeaders, primaryOverhead);
    }
});

tailor.on('end', () => {
    // reset
    primaryOverhead = 0;
});

tailor.on('fragment:start', (request, fragment) => {
    fragments.set(fragment, process.hrtime());
});

tailor.on('fragment:response', (request, fragment) => {
    const startTime = fragments.get(fragment);
    if (fragment.primary) {
        primaryOverhead = getMillisecs(process.hrtime(startTime));
    }
});

tailor.on('error', (request, error) => {
    console.log('Tailor Error ', error);
});

// Tailor server
const server = http.createServer(tailor.requestHandler);
server.listen(8080);

//Mock fragment server
const fragment = spawn('node' ,['perf/fragment-server.js']);
// Load testing
const worker = spawn('node' ,['perf/loadtest.js']);
worker.stdout.pipe(process.stdout);

worker.on('close', () => {
    console.log('Tailor Overhead Metrics', JSON.stringify(histogram.printObj(), null, 2));
    fragment.kill();
    worker.kill();
    process.exit(0);
});
