'use strict';
const AsyncStream = require('./streams/async-stream');
const parseLinkHeader = require('parse-link-header');
const Fragment = require('./fragment');
const StringifierStream = require('./streams/stringifier-stream');
const ContentLengthStream = require('./streams/content-length-stream');
const FRAGMENT_EVENTS = ['start', 'response', 'end', 'error', 'timeout', 'fallback', 'warn'];
const { TEMPLATE_NOT_FOUND } = require('./fetch-template');

/**
 * Process the HTTP Request to the Tailor Middleware
 *
 * @param {Object} options - Options object passed to Tailor
 * @param {Object} request - HTTP request stream of Middleware
 * @param {Object} response - HTTP response stream of middleware
 */
module.exports = function processRequest (options, request, response) {
    this.emit('start', request);

    const { fetchContext, fetchTemplate, handleTag,
            parseTemplate, requestFragment, fragmentTag,
            pipeAttributes, pipeInstanceName, pipeDefinition } = options;

    const asyncStream = new AsyncStream();
    const contextPromise = fetchContext(request).catch((err) => {
        this.emit('context:error', request, err);
        return {};
    });
    const templatePromise = fetchTemplate(request, parseTemplate);
    const responseHeaders = {
        // Disable cache in browsers and proxies
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Content-Type': 'text/html'
    };

    let shouldWriteHead = true;
    let index = 0;
    let assetsToPreload = '';

    // Early preloading in browsers to improve the primary fragments
    const getAssetsToPreload = (fragmentReq, fragment, statusCode, headers) => {
        // Do not preload assets for non primary fragments
        if (!fragment.primary) {
            return;
        }
        const links = parseLinkHeader(headers.link);
        // Remove the event listener once we are done capturing the necessary assets
        // to make sure we are not exceeding EventListener's limit (10 default)
        this.removeListener('fragment:response', getAssetsToPreload);

        // Handle Server rendered fragments without depending on assets
        if (links == null) {
            return;
        }
        if (links.stylesheet && links.stylesheet.url) {
            assetsToPreload += `<${links.stylesheet.url}>; rel="preload"; as="style",`;
        }
        if (links['fragment-script'] && links['fragment-script'].url) {
            assetsToPreload += `<${links['fragment-script'].url}>; rel="preload"; as="script",`;
        }
    };

    this.on('fragment:response', getAssetsToPreload);

    contextPromise.then((context) => {

        const contentLengthStream = new ContentLengthStream((contentLength) => {
            this.emit('end', request, contentLength);
        });

        const resultStream = new StringifierStream((tag) => {
            const { placeholder, name, } = tag;
            if (placeholder === 'pipe') {
                return pipeDefinition(pipeInstanceName);
            }

            if (placeholder === 'async') {
                // end of body tag
                return asyncStream;
            }

            if (name === fragmentTag) {
                const fragment = new Fragment({
                    tag,
                    context,
                    index: index++,
                    requestFragment,
                    pipeInstanceName,
                    pipeAttributes
                });

                FRAGMENT_EVENTS.forEach((eventName) => {
                    fragment.on(eventName, (...args) => {
                        const prefixedName = 'fragment:' + eventName;
                        this.emit(prefixedName, request, fragment.attributes, ...args);
                    });
                });

                const { attributes: { async, primary }, stream } = fragment;

                if (async) {
                    asyncStream.write(stream);
                }

                if (primary && shouldWriteHead) {
                    shouldWriteHead = false;
                    fragment.on('response', (statusCode, headers) => {
                        if (headers.location) {
                            responseHeaders['Location'] = headers.location;
                        }
                        this.emit('response', request, statusCode, responseHeaders);
                        // Make resources early discoverable while processing HTML
                        assetsToPreload && response.setHeader('Link', assetsToPreload);
                        response.writeHead(statusCode, responseHeaders);
                        resultStream
                            .pipe(contentLengthStream)
                            .pipe(response);
                    });
                    fragment.on('fallback', (err) => {
                        this.emit('error', request, err);
                        response.writeHead(500, responseHeaders);
                        resultStream
                            .pipe(contentLengthStream)
                            .pipe(response);
                    });
                    fragment.on('error', (err) => {
                        this.emit('error', request, err);
                        response.writeHead(500, responseHeaders);
                        response.end();
                    });
                }

                return fragment.fetch(request, false);
            }

            return handleTag(request, tag);
        });

        resultStream.on('finish', () => {
            // Flush the async stream only after stringifer stream is finished
            // This guarentees the async fragments are flushed to the client at last
            asyncStream.end();
            const statusCode = response.statusCode || 200;
            if (shouldWriteHead) {
                shouldWriteHead = false;
                this.emit('response', request, statusCode, responseHeaders);
                response.writeHead(statusCode, responseHeaders);
                resultStream
                    .pipe(contentLengthStream)
                    .pipe(response);
            }
        });

        resultStream.on('error', (err) => {
            this.emit('error', request, err);
            if (shouldWriteHead) {
                shouldWriteHead = false;
                let statusCode = 500;
                if (err.code === TEMPLATE_NOT_FOUND) {
                    statusCode = 404;
                }

                response.writeHead(statusCode, responseHeaders);
                // To render with custom error template
                if (typeof err.presentable === 'string') {
                    response.end(`${err.presentable}`);
                } else {
                    response.end();
                }
            } else {
                contentLengthStream.end();
            }
        });

        templatePromise
            .then((parsedTemplate) => {
                if (Array.isArray(parsedTemplate)) {
                    parsedTemplate.forEach((item) => {
                        resultStream.write(item);
                    });
                    resultStream.end();
                } else {
                    resultStream.end(parsedTemplate);
                }
            })
            .catch((err) => {
                resultStream.emit('error', err);
            });
    });
};
