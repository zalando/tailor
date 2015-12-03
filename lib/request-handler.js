'use strict';
const BigPipeStream = require('./streams/big-pipe-stream');
const Fragment = require('./fragment');
const PassThroughStream = require('stream').PassThrough;
const StringifierStream = require('./streams/stringifier-stream');

module.exports = function processRequest (options, request, response) {
    const fetchContext = options.fetchContext;
    const fetchTemplate = options.fetchTemplate;
    const filterHeaders = options.filterHeaders;
    const cdnUrl = options.cdnUrl;
    const handleTag = options.handleTag;
    const parseTemplate = options.parseTemplate;

    const bigPipeStream = new BigPipeStream();
    const contextPromise = fetchContext(request);
    const forceSmartPipe = options.forceSmartPipe(request);
    const resultStream = new PassThroughStream();
    const templatePromise = fetchTemplate(request, parseTemplate);

    let shouldWriteHead = true;
    let primaryId;

    contextPromise.then((context) => {

        const templateStream = new StringifierStream((tag) => {

            if (!tag.name && !tag.closingTag) {
                // end of body tag
                return bigPipeStream;
            }

            if (tag.name === options.fragmentTag) {
                const fragment = new Fragment(tag, context, forceSmartPipe, cdnUrl);

                if (fragment.async) {
                    bigPipeStream.write(fragment.asyncStream);
                }

                if (fragment.primary && !primaryId) {
                    primaryId = fragment.id;
                    shouldWriteHead = false;
                }
                fragment.on('response', (fragmentResponse) => {
                    if (fragment.id === primaryId) {
                        response.writeHead(
                            fragmentResponse.statusCode,
                            {
                                'Content-Type': 'text/html',
                                'Location': fragmentResponse.headers.location
                            }
                        );
                        resultStream.pipe(response);
                    }
                });
                fragment.on('timeout', () => {
                    if (fragment.id === primaryId) {
                        response.writeHead(503, {'Content-Type': 'text/html'});
                        response.end('Service Temporarily Unavailable');
                    }
                });
                fragment.on('error', () => {
                    if (fragment.id === primaryId) {
                        response.writeHead(503, {'Content-Type': 'text/html'});
                        response.end('Service Temporarily Unavailable');
                    }
                });
                return fragment.fetch(
                    filterHeaders(request.headers)
                );
            }

            return handleTag(tag);
        });

        templateStream.on('finish', () => {
            bigPipeStream.end();
            if (shouldWriteHead) {
                shouldWriteHead = false;
                response.writeHead(200, {'Content-Type': 'text/html'});
                resultStream.pipe(response);
            }
        });

        templateStream.on('error', (err) => {
            if (shouldWriteHead) {
                shouldWriteHead = false;
                response.writeHead(500, {'Content-Type': 'text/plain'});
            }
            response.end(err.stack);
        });

        templatePromise
            .then((template) => {
                template.pipe(templateStream).pipe(resultStream);
            })
            .catch((err) => {
                if (shouldWriteHead) {
                    shouldWriteHead = false;
                    response.writeHead(500, {'Content-Type': 'text/plain'});
                }
                response.end(err.message);
            });
    });
};
