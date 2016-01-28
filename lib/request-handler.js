'use strict';
const AsyncStream = require('./streams/async-stream');
const Fragment = require('./fragment');
const StringifierStream = require('./streams/stringifier-stream');
const ContentLengthStream = require('./streams/content-length-stream');
const FRAGMENT_EVENTS = ['start', 'response', 'end', 'error', 'timeout'];

module.exports = function processRequest (options, request, response) {

    this.emit('start', request);

    const fetchContext = options.fetchContext;
    const fetchTemplate = options.fetchTemplate;
    const filterHeaders = options.filterHeaders;
    const handleTag = options.handleTag;
    const parseTemplate = options.parseTemplate;
    const requestFragment = options.requestFragment;

    const asyncStream = new AsyncStream();
    const contextPromise = fetchContext(request).catch((err) => {
        this.emit('context:error', request, err);
        return {};
    });
    const forceSmartPipe = options.forceSmartPipe(request);
    const templatePromise = fetchTemplate(request, parseTemplate);

    let shouldWriteHead = true;

    contextPromise.then((context) => {

        const resultStream = new StringifierStream((tag) => {

            if (!tag.name && !tag.closingTag) {
                // end of body tag
                return asyncStream;
            }

            if (tag.name === options.fragmentTag) {
                const fragment = new Fragment(tag, context, forceSmartPipe, requestFragment);

                FRAGMENT_EVENTS.forEach((eventName) => {
                    fragment.on(eventName, (function () {
                        // this has to be a function, because
                        // arrow functions don't have `arguments`
                        const prefixedName = 'fragment:' + eventName;
                        const prefixedArgs = [prefixedName, request, fragment.attributes].concat(...arguments);
                        this.emit.apply(this, prefixedArgs);
                    }).bind(this));
                });

                if (fragment.attributes.async) {
                    asyncStream.write(fragment.stream);
                }

                if (fragment.attributes.primary && shouldWriteHead) {
                    shouldWriteHead = false;
                    fragment.on('response', (statusCode, headers) => {
                        const responseHeaders = {
                            'Content-Type': 'text/html',
                            'Location': headers.location
                        };
                        this.emit('response', request, statusCode, responseHeaders);
                        response.writeHead(statusCode, responseHeaders);
                        resultStream
                            .pipe(new ContentLengthStream((contentLength) => {
                                this.emit('end', request, contentLength);
                            }))
                            .pipe(response);
                    });
                    fragment.on('error', (err) => {
                        this.emit('primary:error', request, fragment.attributes, err);
                        response.writeHead(500, {'Content-Type': 'text/html'});
                        response.end();
                    });
                }

                return fragment.fetch(
                    filterHeaders(fragment.attributes, request.headers)
                );
            }

            return handleTag(request, tag);
        });

        resultStream.on('finish', () => {
            asyncStream.end();
            if (shouldWriteHead) {
                shouldWriteHead = false;
                this.emit('response', request, 200, {'Content-Type': 'text/html'});
                response.writeHead(200, {'Content-Type': 'text/html'});
                resultStream
                    .pipe(new ContentLengthStream((contentLength) => {
                        this.emit('end', request, contentLength);
                    }))
                    .pipe(response);
            }
        });

        resultStream.on('error', (err) => {
            this.emit('template:error', request, err);
            resultStream.unpipe();  // in case we output something
            if (shouldWriteHead) {
                shouldWriteHead = false;
                response.writeHead(500, {'Content-Type': 'text/plain'});
            }
            response.end();
        });

        templatePromise
            .then((template) => {
                template.on('error', (err) => {
                    resultStream.emit('error', err);
                });
                template.pipe(resultStream);
            })
            .catch((err) => {
                resultStream.emit('error', err);
            });
    });
};
