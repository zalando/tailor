'use strict';

const EventEmitter = require('events').EventEmitter;
const Httpz = require('httpz');
const stream = require('stream');
const parseLinkHeader = require('parse-link-header');
const url = require('url');
const extractUrl = (tag, context) => {
    if (context && tag.attributes.id && context[tag.attributes.id]) {
        return context[tag.attributes.id];
    } else {
        return tag.attributes.src;
    }
};

module.exports = class Fragment extends EventEmitter {

    constructor (tag, context, forceSmartPipe, cdnUrl) {
        super();
        this.url = extractUrl(tag, context);
        this.cdnUrl = cdnUrl;
        this.async = tag.attributes.async !== undefined && !forceSmartPipe;
        this.timeout = parseInt(tag.attributes.timeout || '10000', 10);
        this.primary = tag.attributes.primary !== undefined;
        this.inline = tag.attributes.inline !== undefined;
        this.id = tag.attributes.id || 'f-' + parseInt(Math.random() * 10000, 10);
        this.stream = new stream.PassThrough();
        if (this.async) {
            this.asyncStream = new stream.PassThrough();
        }
    }

    fetch (headers) {
        const parsedUrl = url.parse(this.url);
        const requestOptions = Object.assign({
            headers: headers,
            keepAlive: true,
            timeout: this.timeout
        }, parsedUrl);
        if (this.async) {
            this.stream.end(`<div id="${this.id}"></div>`);
        }
        const httpz = new Httpz();
        this.emit('start');
        httpz.request(requestOptions).then(
            (res) => this.onResponse(res),
            (err) => {
                if (err.message === 'Request aborted') {
                    this.emit('timeout');
                } else {
                    this.emit('error', err);
                }
                if (this.async) {
                    this.asyncStream.end(err.toString());
                } else {
                    this.stream.end(err.toString());
                }
            });
        return this.stream;
    }

    onResponse (response) {
        let contentSize = 0;
        this.emit('response', response.statusCode, response.headers);
        response.on('data', (chunk) => contentSize += chunk.length);
        response.on('end', () => this.emit('end', contentSize));
        this.links = parseLinkHeader([response.headers.link, response.headers['x-amz-meta-link']].join(','));
        if (this.async) {
            this.asyncStream.write(`<div style="display:none;" id="async-${this.id}">`);
            response.pipe(this.asyncStream, {end: false});
            response.on('end', () => {
                this.asyncStream.write('</div>');
                this.initAsyncScript();
                this.asyncStream.end();
            });
        } else {
            this.insertLinks();
            if (!this.inline) {
                this.stream.write(`<div id="${this.id}">`);
            }
            response.pipe(this.stream, {end: false});
            response.on('end', () => {
                if (!this.inline) {
                    this.stream.write('</div>');
                    this.initScript();
                }
                this.stream.end();
            });
        }
    }

    insertLinks () {
        if (!this.links) {
            return;
        }
        if (this.links.stylesheet) {
            this.stream.write(`<link rel="stylesheet" href="${this.cdnUrl(this.links.stylesheet.url)}">`);
        }
        if (this.links['fragment-script']) {
            this.stream.write(`<script>require(["${this.cdnUrl(this.links['fragment-script'].url)}"])</script>`);
        }
    }

    initScript () {
        if (this.links && this.links['fragment-script']) {
            this.stream.write(`<script>pipe("${this.id}", "${this.cdnUrl(this.links['fragment-script'].url)}")</script>`);
        }
    }

    initAsyncScript () {
        if (this.links && this.links.stylesheet) {
            this.asyncStream.write(`<link rel="stylesheet" href="${this.cdnUrl(this.links.stylesheet.url)}">`);
        }
        this.asyncStream.write(`<script>pipe("${this.id}", `);
        if (this.links && this.links['fragment-script']) {
            this.asyncStream.write(`"${this.cdnUrl(this.links['fragment-script'].url)}"`);
        } else {
            this.asyncStream.write('false');
        }
        this.asyncStream.write(', true)</script>');
    }

};
