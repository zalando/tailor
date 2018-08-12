'use strict';

const EventEmitter = require('events').EventEmitter;
const PassThrough = require('stream').PassThrough;
const zlib = require('zlib');
const ContentLengthStream = require('./streams/content-length-stream');
const parseLinkHeader = require('./parse-link-header');
const { getFragmentAssetUris } = require('./utils');

const { globalTracer, Tags } = require('opentracing');
const tracer = globalTracer();

const hasValue = value => {
    if (value || value === '') {
        return true;
    }
    return false;
};

/**
 * Merge the attributes based on the fragment tag attributes and context
 *
 * @param {object} tag - Fragment tag from the template
 * @param {object=} context - Context object for the given fragment
 * @returns {object}
 */
const getAttributes = (tag, context) => {
    const attributes = Object.assign({}, tag.attributes);
    const fragmentId = attributes.id;
    if (context && fragmentId && context[fragmentId]) {
        const fragmentCtxt = context[fragmentId];
        Object.assign(attributes, fragmentCtxt);
    }

    const {
        src,
        async: isAsync,
        primary,
        public: isPublic,
        timeout
    } = attributes;

    return {
        url: src,
        id: fragmentId,
        async: hasValue(isAsync),
        primary: hasValue(primary),
        public: hasValue(isPublic),
        fallbackUrl: attributes['fallback-src'],
        timeout: parseInt(timeout || 3000, 10)
    };
};

/**
 * Class representing a Fragment
 * @extends EventEmitter
 */
module.exports = class Fragment extends EventEmitter {
    /**
     * Create a Fragment
     * @param {Object} tag - Fragment tag from the template
     * @param {object} context - Context object for the given fragment
     * @param {number} index - Order of the fragment
     * @param {function} requestFragment - Function to request the fragment
     * @param {string} pipeInstanceName - Pipe instance name that is available in the browser window for consuming hooks
     */
    constructor(
        {
            tag,
            context,
            index,
            requestFragment,
            pipeInstanceName,
            maxAssetLinks,
            pipeAttributes = () => {}
        } = {}
    ) {
        super();
        this.attributes = getAttributes(tag, context);
        this.index = index;
        this.maxAssetLinks = maxAssetLinks;
        this.pipeAttributes = pipeAttributes(
            Object.assign({ id: this.index }, tag.attributes)
        );
        this.requestFragment = requestFragment;
        this.pipeInstanceName = pipeInstanceName;
        this.stream = new PassThrough();
        this.scriptRefs = [];
        this.styleRefs = [];
    }

    /**
     * Handles fetching the fragment
     * @param {object} request - HTTP request stream
     * @param {boolean} isFallback - decides between fragment and fallback URL
     * @param {object} parentSpan - opentracing Span that will be the parent of the current operation
     * @returns {object} Fragment response streams in case of synchronous fragment or buffer in case of async fragment
     */
    fetch(request, isFallback = false, parentSpan = null) {
        if (!isFallback) {
            this.emit('start');
        }
        const url = isFallback
            ? this.attributes.fallbackUrl
            : this.attributes.url;

        const spanOptions = parentSpan ? { childOf: parentSpan } : {};
        const span = tracer.startSpan('fetch-fragment', spanOptions);

        const {
            id,
            primary,
            async: isAsync,
            public: isPublic
        } = this.attributes;

        span.addTags({
            [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_CLIENT,
            [Tags.HTTP_URL]: url,
            fallback: isFallback,
            public: isPublic,
            async: isAsync,
            id: id || 'unnamed',
            primary
        });

        this.requestFragment(url, this.attributes, request, span).then(
            res => this.onResponse(res, isFallback, span),
            err => {
                if (!isFallback) {
                    if (this.attributes.fallbackUrl) {
                        this.emit('fallback', err);
                        this.fetch(request, true, span);
                    } else {
                        span.setTag(Tags.ERROR, true);
                        span.log({
                            message: err.message
                        });
                        this.emit('error', err);
                        this.stream.end();
                    }
                } else {
                    span.setTag(Tags.ERROR, true);
                    span.log({
                        message: err.message
                    });
                    this.stream.end();
                }
                span.finish();
            }
        );
        // Async fragments are piped later on the page
        if (isAsync) {
            return Buffer.from(
                `<script data-pipe>${this.pipeInstanceName}.placeholder(${this
                    .index})</script>`
            );
        }
        return this.stream;
    }

    /**
     * Handle the fragment response
     * @param {object} response - HTTP response stream from fragment
     * @param {boolean} isFallback - decides between response from fragment src or fallback src
     * @param {object} span - fetch-fragment opentracing span
     */
    onResponse(response, isFallback, span) {
        const { statusCode, headers } = response;

        // Extract the assets from fragment link headers.
        const refs = parseLinkHeader(
            [headers.link, headers['x-amz-meta-link']].join(',')
        );

        if (refs.length > 0) {
            [this.scriptRefs, this.styleRefs] = getFragmentAssetUris(
                refs,
                this.maxAssetLinks
            );
        }

        if (!isFallback) {
            this.emit('response', statusCode, headers);
        }

        this.insertStart();

        const contentLengthStream = new ContentLengthStream(contentLength => {
            if (!isFallback) {
                this.emit('end', contentLength);
            }
        });

        contentLengthStream.on('end', () => {
            this.insertEnd();
            this.stream.end();
            span.finish();
        });

        const handleError = err => {
            this.emit('warn', err);
            contentLengthStream.end();
        };

        // Handle errors on all piped streams
        response.on('error', handleError);
        contentLengthStream.on('error', handleError);

        // Unzip the fragment response if gzipped before piping it to the Client(Browser) - Composition will break otherwise
        let responseStream = response;
        const contentEncoding = headers['content-encoding'];
        if (
            contentEncoding &&
            (contentEncoding === 'gzip' || contentEncoding === 'deflate')
        ) {
            let unzipStream = zlib.createUnzip();
            unzipStream.on('error', handleError);
            responseStream = response.pipe(unzipStream);
        }

        responseStream
            .pipe(contentLengthStream)
            .pipe(this.stream, { end: false });
    }

    /**
     * Insert the placeholder for pipe assets and load the required JS and CSS assets at the start of fragment stream
     *
     * - JS assets are loading via AMD(requirejs) for both sync and async fragments
     * - CSS for the async fragments are loaded using custom loadCSS(available in src/pipe.js)
     */
    insertStart() {
        const { async: isAsync, id } = this.attributes;
        this.styleRefs.forEach(uri => {
            this.stream.write(
                isAsync
                    ? `<script>${this
                          .pipeInstanceName}.loadCSS("${uri}")</script>`
                    : `<link rel="stylesheet" href="${uri}">`
            );
        });

        if (this.scriptRefs.length === 0) {
            this.stream.write(
                `<script data-pipe>${this.pipeInstanceName}.start(${this
                    .index})</script>`
            );
            this.index++;
            return;
        }

        const range = [this.index, this.index + this.scriptRefs.length - 1];
        const fragmentId = id || range[0];
        const attributes = Object.assign({}, this.pipeAttributes, {
            id: fragmentId,
            range
        });
        this.scriptRefs.forEach(uri => {
            this.stream.write(
                `<script data-pipe>${this.pipeInstanceName}.start(${this
                    .index}, "${uri}", ${JSON.stringify(attributes)})</script>`
            );
            this.index++;
        });
    }

    /**
     * Insert the placeholder for pipe assets at the end of fragment stream
     */
    insertEnd() {
        if (this.scriptRefs.length > 0) {
            const range = [this.index - this.scriptRefs.length, this.index - 1];
            this.index--;
            const fragmentId = this.attributes.id || range[0];
            const attributes = Object.assign({}, this.pipeAttributes, {
                id: fragmentId,
                range
            });
            this.scriptRefs.reverse().forEach(uri => {
                this.stream.write(
                    `<script data-pipe>${this.pipeInstanceName}.end(${this
                        .index--}, "${uri}", ${JSON.stringify(
                        attributes
                    )})</script>`
                );
            });
        } else {
            this.stream.write(
                `<script data-pipe>${this.pipeInstanceName}.end(${this.index -
                    1})</script>`
            );
        }
    }
};
