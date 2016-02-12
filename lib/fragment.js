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

    constructor (tag, context, forceSmartPipe, requestFragment) {
        super();
        this.attributes = {
            url: extractUrl(tag, context),
            timeout: parseInt(tag.attributes.timeout || 3000, 10),
            id: tag.attributes.id || 'f-' + parseInt(Math.random() * 10000, 10),
            fallbackUrl: tag.attributes['fallback-src']
        };
        ['async', 'inline', 'primary', 'public'].forEach((key) => {
            this.attributes[key] = tag.attributes[key] !== undefined;
        });
        if (forceSmartPipe) {
            this.attributes.async = false;
        }
        this.requestFragment = requestFragment;
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
            return new Buffer(`<div id="${this.attributes.id}"></div>`);
        }
        return this.stream;
    }

    onResponse (response, isFallback) {
        if (!isFallback) {
            this.emit('response', response.statusCode, response.headers);
        }

        this.links = parseLinkHeader([response.headers.link, response.headers['x-amz-meta-link']].join(','));
        if (this.attributes.async) {
            this.stream.write(`<div style="display:none;" id="async-${this.attributes.id}">`);
        }  else {
            this.insertLinks();
            if (!this.attributes.inline) {
                this.stream.write(`<div id="${this.attributes.id}">`);
            }
        }

        const contentLengthStream = new ContentLengthStream((contentLength) => {
            if (!isFallback) {
                this.emit('end', contentLength);
            }
            if (!this.attributes.inline) {
                this.stream.write('</div>');
                if (this.attributes.async) {
                    this.initAsyncScript();
                } else {
                    this.initScript();
                }
            }
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

    insertLinks () {
        if (!this.links) {
            return;
        }
        if (this.links.stylesheet) {
            this.stream.write(`<link rel="stylesheet" href="${this.links.stylesheet.url}">`);
        }
        if (this.links['fragment-script']) {
            this.stream.write(`<script>require(["${this.links['fragment-script'].url}"])</script>`);
        }
    }

    initScript () {
        if (this.links && this.links['fragment-script']) {
            this.stream.write(`<script>pipe("${this.attributes.id}", "${this.links['fragment-script'].url}")</script>`);
        }
    }

    initAsyncScript () {
        if (this.links && this.links.stylesheet) {
            this.stream.write(`<link rel="stylesheet" href="${this.links.stylesheet.url}">`);
        }
        this.stream.write(`<script>pipe("${this.attributes.id}", `);
        if (this.links && this.links['fragment-script']) {
            this.stream.write(`"${this.links['fragment-script'].url}"`);
        } else {
            this.stream.write('false');
        }
        this.stream.write(', true)</script>');
    }

};
