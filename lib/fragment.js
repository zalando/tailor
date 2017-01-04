'use strict';

const ContentLengthStream = require('./streams/content-length-stream');
const EventEmitter = require('events').EventEmitter;
const PassThrough = require('stream').PassThrough;
const parseLinkHeader = require('parse-link-header');
const zlib = require('zlib');

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
    return {
        url: attributes.src,
        id: fragmentId,
        fallbackUrl: attributes['fallback-src'],
        timeout: parseInt(attributes.timeout || 3000, 10),
        async: attributes.async,
        primary: attributes.primary,
        public: attributes.public,
        main: attributes.main
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
     * @param {string} pipeInstanceName - Pipe instance name generated randomly and used in client side for the layout
     */
    constructor (tag, context, index, requestFragment, pipeInstanceName) {
        super();
        this.attributes = getAttributes(tag, context);
        ['async', 'primary', 'public', 'main'].forEach((key) => {
            let value = this.attributes[key];
            if (value || value === '') {
                value = true;
            } else {
                value = false;
            }
            this.attributes[key] = value;
        });
        this.index = index;
        this.fragmentId = this.attributes.id ? this.attributes.id : this.index;
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
    fetch (request, isFallback) {
        if (!isFallback) {
            this.emit('start');
        }
        const url = isFallback ? this.attributes.fallbackUrl : this.attributes.url;

        this.requestFragment(url, this.attributes, request).then(
            (res) => this.onResponse(res, isFallback),
            (err) => {
                if (!isFallback) {
                    const fallbackUrl = this.attributes.fallbackUrl;
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
            return new Buffer(`<script data-pipe>${this.pipeInstanceName}.placeholder(${this.index})</script>`);
        }
        return this.stream;
    }

    /**
     * Handle the fragment response
     * @param {object} response - HTTP response stream from fragment
     * @param {boolean} isFallback - decides between response from fragment or fallback URL
     */
    onResponse (response, isFallback) {
        if (!isFallback) {
            this.emit('response', response.statusCode, response.headers);
        }
        // Extract the assets from fragment link headers.
        this.links = parseLinkHeader([response.headers.link, response.headers['x-amz-meta-link']].join(','));

        this.insertStart();

        const contentLengthStream = new ContentLengthStream((contentLength) => {
            if (!isFallback) {
                this.emit('end', contentLength);
            }
        });

        contentLengthStream.on('end', () => {
            this.insertEnd();
            this.stream.end();
        });

        const handleError = (err) => {
            this.emit('warn', err);
            contentLengthStream.end();
        };

        // Handle errors on all piped streams
        response.on('error', handleError);
        contentLengthStream.on('error', handleError);

        // Unzip the fragment response if gzipped before piping it to the Client(Browser) - Composition will break otherwise
        let responseStream = response;
        const contentEncoding = response.headers['content-encoding'];
        if (contentEncoding &&
            (contentEncoding === 'gzip' || contentEncoding === 'deflate')) {
            let unzipStream = zlib.createUnzip();
            unzipStream.on('error', handleError);
            responseStream = response.pipe(unzipStream);
        }

        responseStream
            .pipe(contentLengthStream)
            .pipe(this.stream, {end: false});
    }

    /**
     * Insert the placeholder for pipe assets and load the required JS and CSS assets at the start of fragment stream
     *
     * - JS assets are loading via AMD(requirejs) for both sync and async fragments
     * - CSS for the async fragments are loaded using custom loadCSS(available in src/pipe.js)
     */
    insertStart () {
        if (this.links.stylesheet) {
            if (this.attributes.async) {
                this.stream.write(`<script>${this.pipeInstanceName}.loadCSS("${this.links.stylesheet.url}")</script>`);
            } else {
                this.stream.write(`<link rel="stylesheet" href="${this.links.stylesheet.url}">`);
            }
        }
        if (this.links && this.links['fragment-script']) {
            const isMainFragment = (this.attributes.main || this.attributes.primary) ? true : false;
            this.stream.write(`<script data-pipe>${this.pipeInstanceName}.start(${this.index}, "${this.links['fragment-script'].url}", ${isMainFragment})</script>`);
        } else {
            this.stream.write(`<script data-pipe>${this.pipeInstanceName}.start(${this.index})</script>`);
        }
    }

    /**
     * Insert the placeholder for pipe assets at the end of fragment stream
     */
    insertEnd () {
        if (this.links && this.links['fragment-script']) {
            this.stream.write(`<script data-pipe>${this.pipeInstanceName}.end(${this.index}, "${this.links['fragment-script'].url}", "${this.fragmentId}")</script>`);
        } else {
            this.stream.write(`<script data-pipe>${this.pipeInstanceName}.end(${this.index})</script>`);
        }
    }

};
