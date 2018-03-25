'use strict';

const ContentLengthStream = require('./streams/content-length-stream');
const EventEmitter = require('events').EventEmitter;
const PassThrough = require('stream').PassThrough;
const LinkHeader = require('http-link-header');
const zlib = require('zlib');
const uuid = require('uuid/v4');

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

    return Object.assign({}, attributes, {
        url: attributes.src,
        id: fragmentId,
        fallbackUrl: attributes['fallback-src'],
        timeout: parseInt(attributes.timeout || 3000, 10)
    });
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
        this.attributes = getAttributes(tag, context, index);
        ['lazy', 'async', 'primary', 'public'].forEach(key => {
            let value = this.attributes[key];
            if (value || value === '') {
                value = true;
            } else {
                value = false;
            }
            this.attributes[key] = value;
        });

        this.index = index;
        this.maxAssetLinks = maxAssetLinks;
        this.getPipeAttributes = () =>
            pipeAttributes(
                Object.assign({}, { id: this.index }, tag.attributes)
            );
        this.requestFragment = requestFragment;
        this.pipeInstanceName = pipeInstanceName;
        this.stream = new PassThrough();
    }

    /**
     * Handles fetching the fragment
     * @param {object} request - HTTP request stream
     * @param {boolean} isFallback - decides between fragment and fallback URL
     * @returns {object} Fragment response streams in case of synchronous fragment or buffer incase of async fragment
     */
    fetch(request, isFallback) {
        if (!isFallback) {
            this.emit('start');
        }
        const url = isFallback
            ? this.attributes.fallbackUrl
            : this.attributes.url;

        this.requestFragment(url, this.attributes, request).then(
            res => this.onResponse(res, isFallback),
            err => {
                if (!isFallback) {
                    const { fallbackUrl } = this.attributes;
                    if (fallbackUrl) {
                        this.emit('fallback', err);
                        this.fetch(request, true);
                    } else {
                        this.emit('error', err);
                        this.stream.end();
                    }
                } else {
                    this.stream.end();
                }
            }
        );
        // Async fragments are piped later on the page
        if (this.attributes.async) {
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
     * @param {boolean} isFallback - decides between response from fragment or fallback URL
     */
    onResponse(response, isFallback) {
        const { statusCode, headers } = response;

        if (!isFallback) {
            this.emit('response', statusCode, headers);
        }
        // Extract the assets from fragment link headers.
        const { refs } = LinkHeader.parse(
            [headers.link, headers['x-amz-meta-link']].join(',')
        );

        this.scriptRefs = [];
        this.lazyScriptRefs = [];
        const scriptRefs = refs
            .filter(ref => ref.rel === 'fragment-script')
            .slice(0, this.maxAssetLinks)
            .map(ref => ref.uri);
        if (!this.attributes.lazy) {
            this.scriptRefs = scriptRefs;
        } else {
            this.lazyScriptRefs = scriptRefs;
        }

        this.styleRefs = refs
            .filter(ref => ref.rel === 'stylesheet')
            .slice(0, this.maxAssetLinks)
            .map(ref => ref.uri);

        this.insertStart();

        const contentLengthStream = new ContentLengthStream(contentLength => {
            if (!isFallback) {
                this.emit('end', contentLength);
            }
        });

        contentLengthStream.on('end', () => {
            if (this.attributes.lazy) {
                this.insertEndObserver();
            }
            this.insertEnd();
            this.stream.end();
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

        if (this.attributes.lazy) {
            this.insertStartObserver();
        }

        responseStream
            .pipe(contentLengthStream)
            .pipe(this.stream, { end: false });
    }

    insertStartObserver() {
        this.lazyFragmentId = this.attributes.id || `z${uuid()}`;
        this.stream.write(`<div id="${this.lazyFragmentId}">`);
    }

    insertEndObserver() {
        this.stream.write(
            `
            </div>
            <script>${this.pipeInstanceName}.observeNodeVisibility("${this
                .lazyFragmentId}", "${this.lazyScriptRefs[0]}");
            </script>
            `
        );
    }

    /**
     * Insert the placeholder for pipe assets and load the required JS and CSS assets at the start of fragment stream
     *
     * - JS assets are loading via AMD(requirejs) for both sync and async fragments
     * - CSS for the async fragments are loaded using custom loadCSS(available in src/pipe.js)
     */
    insertStart() {
        this.styleRefs.forEach(uri => {
            this.stream.write(
                this.attributes.async
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
        const fragmentId = this.attributes.id || range[0];
        this.scriptRefs.forEach(uri => {
            const attributes = Object.assign({}, this.getPipeAttributes(), {
                id: fragmentId,
                range
            });
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
            this.scriptRefs.reverse().forEach(uri => {
                const attributes = Object.assign({}, this.getPipeAttributes(), {
                    id: fragmentId,
                    range
                });
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
