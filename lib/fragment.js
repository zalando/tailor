'use strict';

const ContentLengthStream = require('./streams/content-length-stream');
const EventEmitter = require('events').EventEmitter;
const PassThrough = require('stream').PassThrough;
const parseLinkHeader = require('parse-link-header');
const extractUrl = (tag, context) => {
    if (context && tag.attributes.id && context[tag.attributes.id]) {
        return context[tag.attributes.id];
    } else {
        return tag.attributes.src;
    }
};

module.exports = class Fragment extends EventEmitter {

    constructor (tag, context, index, requestFragment, pipeInstanceName) {
        super();
        this.attributes = {
            url: extractUrl(tag, context),
            timeout: parseInt(tag.attributes.timeout || 3000, 10),
            fallbackUrl: tag.attributes['fallback-src']
        };
        ['async', 'primary', 'public'].forEach((key) => {
            this.attributes[key] = tag.attributes[key] !== undefined;
        });
        this.index = index;
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
            return new Buffer(`<script>${this.pipeInstanceName}.placeholder(${this.index})</script>`);
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
            this.stream.write(`<script>${this.pipeInstanceName}.start(${this.index}, "${this.links['fragment-script'].url}")</script>`);
        } else {
            this.stream.write(`<script>${this.pipeInstanceName}.start(${this.index})</script>`);
        }
    }

    insertEnd () {
        if (this.links && this.links['fragment-script']) {
            this.stream.write(`<script>${this.pipeInstanceName}.end(${this.index}, "${this.links['fragment-script'].url}")</script>`);
        } else {
            this.stream.write(`<script>${this.pipeInstanceName}.end(${this.index})</script>`);
        }
    }

};
