'use strict';

const AsyncStream = require('./streams/async-stream');
const ContentLengthStream = require('./streams/content-length-stream');
const { TEMPLATE_NOT_FOUND } = require('./fetch-template');
const processTemplate = require('./process-template');
const {
    getLoaderScript,
    getFragmentAssetsToPreload,
    nextIndexGenerator
} = require('./utils');

const { globalTracer, Tags, FORMAT_HTTP_HEADERS } = require('opentracing');
const tracer = globalTracer();

// Events emitted by fragments on the template
const FRAGMENT_EVENTS = [
    'start',
    'response',
    'end',
    'error',
    'timeout',
    'fallback',
    'warn'
];

/**
 * Process the HTTP Request to the Tailor Middleware
 *
 * @param {Object} options - Options object passed to Tailor
 * @param {Object} request - HTTP request stream of Middleware
 * @param {Object} response - HTTP response stream of middleware
 */
module.exports = function processRequest(options, request, response) {
    this.emit('start', request);
    const parentSpanContext = tracer.extract(
        FORMAT_HTTP_HEADERS,
        request.headers
    );
    const spanOptions = parentSpanContext ? { childOf: parentSpanContext } : {};
    const span = tracer.startSpan('handle-request', spanOptions);
    span.addTags({
        [Tags.HTTP_URL]: request.url,
        [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_SERVER
    });

    const {
        fetchContext,
        fetchTemplate,
        parseTemplate,
        filterResponseHeaders,
        maxAssetLinks,
        amdLoaderUrl
    } = options;

    const asyncStream = new AsyncStream();
    asyncStream.once('plugged', () => {
        asyncStream.end();
    });

    const contextPromise = fetchContext(request).catch(err => {
        this.emit('context:error', request, err);
        return {};
    });
    const templatePromise = fetchTemplate(request, parseTemplate);
    const responseHeaders = {
        // Disable cache in browsers and proxies
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        'Content-Type': 'text/html'
    };

    let shouldWriteHead = true;

    const contentLengthStream = new ContentLengthStream(contentLength => {
        this.emit('end', request, contentLength);
        span.finish();
    });

    const handleError = err => {
        this.emit('error', request, err);
        span.setTag(Tags.ERROR, true);
        span.log({
            message: err.message,
            stack: err.stack
        });
        if (shouldWriteHead) {
            shouldWriteHead = false;
            let statusCode = 500;
            if (err.code === TEMPLATE_NOT_FOUND) {
                statusCode = 404;
            }
            span.setTag(Tags.HTTP_STATUS_CODE, statusCode);

            response.writeHead(statusCode, responseHeaders);
            // To render with custom error template
            if (typeof err.presentable === 'string') {
                response.end(`${err.presentable}`);
            } else {
                response.end();
            }
            span.finish();
        } else {
            contentLengthStream.end();
        }
    };

    const handlePrimaryFragment = (fragment, resultStream) => {
        if (!shouldWriteHead) {
            return;
        }

        shouldWriteHead = false;

        fragment.once('response', (statusCode, headers) => {
            // Map response headers
            if (typeof filterResponseHeaders === 'function') {
                Object.assign(
                    responseHeaders,
                    filterResponseHeaders(fragment.attributes, headers)
                );
            }

            if (headers.location) {
                responseHeaders.location = headers.location;
            }

            // Make resources early discoverable while processing HTML
            const assetsToPreload = getFragmentAssetsToPreload(
                headers,
                request.headers
            );

            // Loader script must be preloaded before every fragment asset
            const loaderScript = getLoaderScript(amdLoaderUrl, request.headers);
            loaderScript !== '' && assetsToPreload.unshift(loaderScript);

            responseHeaders.link = assetsToPreload.join(',');
            this.emit('response', request, statusCode, responseHeaders);

            response.writeHead(statusCode, responseHeaders);
            resultStream.pipe(contentLengthStream).pipe(response);
        });

        fragment.once('fallback', err => {
            this.emit('error', request, err);
            span.setTag(Tags.HTTP_STATUS_CODE, 500);
            response.writeHead(500, responseHeaders);
            resultStream.pipe(contentLengthStream).pipe(response);
        });

        fragment.once('error', err => {
            this.emit('error', request, err);
            span.setTag(Tags.HTTP_STATUS_CODE, 500);
            response.writeHead(500, responseHeaders);
            response.end();
        });
    };

    Promise.all([templatePromise, contextPromise])
        .then(([parsedTemplate, context]) => {
            // extendedOptions are mutated inside processTemplate
            const extendedOptions = Object.assign({}, options, {
                nextIndex: nextIndexGenerator(0, maxAssetLinks),
                parentSpan: span,
                asyncStream
            });

            const resultStream = processTemplate(
                request,
                extendedOptions,
                context
            );
            let isFragmentFound = false;

            resultStream.on('fragment:found', fragment => {
                isFragmentFound = true;
                FRAGMENT_EVENTS.forEach(eventName => {
                    fragment.once(eventName, (...args) => {
                        const prefixedName = 'fragment:' + eventName;
                        this.emit(
                            prefixedName,
                            request,
                            fragment.attributes,
                            ...args
                        );
                    });
                });

                const { primary } = fragment.attributes;
                primary && handlePrimaryFragment(fragment, resultStream);
            });

            resultStream.once('finish', () => {
                const statusCode = response.statusCode || 200;
                if (shouldWriteHead) {
                    shouldWriteHead = false;
                    // Preload the loader script when at least
                    // one fragment is present on the page
                    if (isFragmentFound) {
                        const loaderScript = getLoaderScript(
                            amdLoaderUrl,
                            request.headers
                        );
                        loaderScript !== '' &&
                            (responseHeaders.link = loaderScript);
                    }
                    this.emit('response', request, statusCode, responseHeaders);

                    response.writeHead(statusCode, responseHeaders);
                    resultStream.pipe(contentLengthStream).pipe(response);
                }
            });

            resultStream.once('error', handleError);

            parsedTemplate.forEach(item => {
                resultStream.write(item);
            });
            resultStream.end();
        })
        .catch(err => {
            handleError(err);
        });
};
