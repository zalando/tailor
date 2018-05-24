'use strict';

const http = require('http');

const Tailor = require('../../');

const tailor = new Tailor({
    templatesPath: __dirname + '/templates'
    // The place to define a custom Opentracing tracer like Jaeger, for ex.
    // tracer: initTracer(config, options);
});

// Root Server
http
    .createServer((req, res) => {
        tailor.requestHandler(req, res);
    })
    .listen(8080, function() {
        console.log('Tailor server listening on port 8080');
    });

// Fragment server - Any http server that can serve fragments
http
    .createServer((req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        res.end('<div>Fragment 1</div>');
    })
    .listen(8081, function() {
        console.log('Fragment Server listening on port 8081');
    });
