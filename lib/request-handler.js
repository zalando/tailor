'use strict';
const BigPipeStream = require('./streams/big-pipe-stream');
const Fragment = require('./fragment');
const PassThroughStream = require('stream').PassThrough;
const StringifierStream = require('./streams/stringifier-stream');
const FRAGMENT_EVENTS = ['start', 'response', 'end', 'error', 'timeout'];

module.exports = function processRequest (options, request, response) {

    this.emit('start', request);

    const fetchContext = options.fetchContext;
    const fetchTemplate = options.fetchTemplate;
    const filterHeaders = options.filterHeaders;
    const handleTag = options.handleTag;
    const parseTemplate = options.parseTemplate;
    const requestFragment = options.requestFragment;

    const bigPipeStream = new BigPipeStream();
    const contextPromise = fetchContext(request).catch((err) => {
        this.emit('context:error', request, err);
        return {};
    });
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
                const fragment = new Fragment(tag, context, forceSmartPipe, requestFragment);

                FRAGMENT_EVENTS.forEach((eventName) => {
                    fragment.on(eventName, (function () {
                        // this has to be a function, because
                        // arrow functions don't have `arguments`
                        const prefixedName = 'fragment:' + eventName;
                        const prefixedArgs = [prefixedName, request, fragment].concat(...arguments);
                        this.emit.apply(this, prefixedArgs);
                    }).bind(this));
                });

                if (fragment.async) {
                    bigPipeStream.write(fragment.asyncStream);
                }

                if (fragment.primary && !primaryId) {
                    primaryId = fragment.id;
                    shouldWriteHead = false;
                }
                fragment.on('response', (statusCode, headers) => {
                    if (fragment.id === primaryId) {
                        this.emit('response', request, statusCode, {
                            'Content-Type': 'text/html',
                            'Location': headers.location
                        });
                        response.writeHead(
                            statusCode,
                            {
                                'Content-Type': 'text/html',
                                'Location': headers.location
                            }
                        );
                        let contentLength = 0;
                        resultStream.on('data', (chunk) => contentLength += chunk.length);
                        resultStream.on('end', () => {
                            this.emit('end', request, contentLength);
                        });
                        resultStream.pipe(response);
                    }
                });
                fragment.on('error', (err) => {
                    if (fragment.id === primaryId) {
                        this.emit('primary:error', request, fragment, err);
                        response.writeHead(500, {'Content-Type': 'text/html'});
                        response.end();
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
                this.emit('response', request, 200, {'Content-Type': 'text/html'});
                response.writeHead(200, {'Content-Type': 'text/html'});
                let contentLength = 0;
                resultStream.on('data', (chunk) => contentLength += chunk.length);
                resultStream.on('end', () => {
                    this.emit('end', request, contentLength);
                });
                resultStream.pipe(response);
            }
        });

        templateStream.on('error', (err) => {
            this.emit('template:error', request, err);
            resultStream.unpipe(); // in case we output something
            if (shouldWriteHead) {
                shouldWriteHead = false;
                response.writeHead(500, {'Content-Type': 'text/plain'});
            }
            response.end();
        });

        templatePromise
            .then((template) => {
                template.on('error', (err) => {
                    templateStream.emit('error', err);
                });
                template.pipe(templateStream).pipe(resultStream);
            })
            .catch((err) => {
                templateStream.emit('error', err);
            });
    });
};
