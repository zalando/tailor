'use strict';

const ContentLengthStream = require('./streams/content-length-stream');
const EventEmitter = require('events').EventEmitter;
const PassThrough = require('stream').PassThrough;
const parseLinkHeader = require('parse-link-header');

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
        public: attributes.public
    };
};

module.exports = class Fragment extends EventEmitter {

    constructor (tag, context, index, requestFragment, pipeInstanceName) {
        super();
        this.attributes = getAttributes(tag, context);
        ['async', 'primary', 'public'].forEach((key) => {
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
        if (this.attributes.async) {
            return new Buffer(`<script data-pipe>${this.pipeInstanceName}.placeholder(${this.index})</script>`);
        }
        return this.stream;
    }

    onResponse (response, isFallback) {
        if (!isFallback) {
            this.emit('response', response.statusCode, response.headers);
        }
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

        response.on('error', (err) => {
            this.emit('warn', err);
            contentLengthStream.end();
        });

        response
            .pipe(contentLengthStream)
            .pipe(this.stream, {end: false});
    }

    insertStart () {
        if (this.links.stylesheet) {
            if (this.attributes.async) {
                this.stream.write(`<script>${this.pipeInstanceName}.loadCSS("${this.links.stylesheet.url}")</script>`);
            } else {
                this.stream.write(`<link rel="stylesheet" href="${this.links.stylesheet.url}">`);
            }
        }
        if (this.links && this.links['fragment-script']) {
            this.stream.write(`<script data-pipe>${this.pipeInstanceName}.start(${this.index}, "${this.links['fragment-script'].url}")</script>`);
        } else {
            this.stream.write(`<script data-pipe>${this.pipeInstanceName}.start(${this.index})</script>`);
        }
    }

    insertEnd () {
        if (this.links && this.links['fragment-script']) {
            this.stream.write(`<script data-pipe>${this.pipeInstanceName}.end(${this.index}, "${this.links['fragment-script'].url}", "${this.fragmentId}")</script>`);
        } else {
            this.stream.write(`<script data-pipe>${this.pipeInstanceName}.end(${this.index})</script>`);
        }
    }

};
