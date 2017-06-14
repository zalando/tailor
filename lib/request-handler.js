'use strict';
const AsyncStream = require('./streams/async-stream');
const LinkHeader = require('http-link-header');
const Fragment = require('./fragment');
const StringifierStream = require('./streams/stringifier-stream');
const ContentLengthStream = require('./streams/content-length-stream');
const FRAGMENT_EVENTS = ['start', 'response', 'end', 'error', 'timeout', 'fallback', 'warn'];
const { TEMPLATE_NOT_FOUND } = require('./fetch-template');
const getCrossOriginHeader = (fragmentUrl, host) => {
    if (host && fragmentUrl.indexOf(`://${host}`) < 0) {
        return 'crossorigin';
    }
    return '';
};

// Early preloading of primary fragments assets to improve Performance
const getAssetsToPreload = ({ link }, { headers = {} }) => {
    let assetsToPreload = [];

    const { refs=[] } = LinkHeader.parse(link) ;
    const scriptRefs = refs.filter(ref => ref.rel === 'fragment-script').map(ref => ref.uri);
    const styleRefs = refs.filter(ref => ref.rel === 'stylesheet').map(ref => ref.uri);

    // Handle Server rendered fragments without depending on assets
    if (!scriptRefs[0] && !styleRefs[0]) {
        return '';
    }
    styleRefs.forEach(uri => {
        assetsToPreload.push(`<${uri}>; rel="preload"; as="style"; nopush`);
    });
    scriptRefs.forEach(uri => {
        const crossOrigin = getCrossOriginHeader(uri, headers.host);
        assetsToPreload.push(`<${uri}>; rel="preload"; as="script"; nopush; ${crossOrigin}`);
    });
    return assetsToPreload.join(',');
};

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
        pipeAttributes, pipeInstanceName, pipeDefinition,
        maxAssetLinks } = options;

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
                    index,
                    requestFragment,
                    pipeInstanceName,
                    pipeAttributes,
                    maxAssetLinks,
                });

                index += maxAssetLinks;

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
                        if (headers['set-cookie']) {
                            responseHeaders['Set-Cookie'] = headers['set-cookie'];
                        }
                        // Make resources early discoverable while processing HTML
                        const preloadAssets = headers.link ? getAssetsToPreload(headers, request) : '';
                        if (preloadAssets !== '') {
                            responseHeaders['Link'] = preloadAssets;
                        }
                        this.emit('response', request, statusCode, responseHeaders);
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
