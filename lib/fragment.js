'use strict';

const EventEmitter = require('events').EventEmitter;
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

    constructor (tag, context, forceSmartPipe, requestFragment) {
        super();
        this.attributes = {
            url: extractUrl(tag, context),
            timeout: parseInt(tag.attributes.timeout || '10000', 10),
            id: tag.attributes.id || 'f-' + parseInt(Math.random() * 10000, 10)
        };
        ['async', 'inline', 'primary', 'public'].forEach((key) => {
            this.attributes[key] = tag.attributes[key] !== undefined;
        });
        if (forceSmartPipe) {
            this.attributes.async = false;
        }
        this.stream = new stream.PassThrough();
        this.requestFragment = requestFragment;
        if (this.attributes.async) {
            this.asyncStream = new stream.PassThrough();
        }
    }

    fetch (headers) {
        const parsedUrl = url.parse(this.attributes.url);
        const requestOptions = Object.assign({
            headers: headers,
            keepAlive: true,
            timeout: this.attributes.timeout
        }, parsedUrl);
        if (this.attributes.async) {
            this.stream.end(`<div id="${this.attributes.id}"></div>`);
        }
        this.emit('start');
        this.requestFragment(requestOptions).then(
            (res) => this.onResponse(res),
            (err) => {
                this.emit('error', err);
                if (this.attributes.async) {
                    this.asyncStream.end();
                } else {
                    this.stream.end();
                }
            }
        );
        return this.stream;
    }

    onResponse (response) {
        let contentSize = 0;
        if (response.statusCode >= 500) {
            this.emit('error', new Error('Internal Server Error'));
            this.stream.end();
            if (this.attributes.async) {
                this.asyncStream.end();
            };
            return;
        }
        this.emit('response', response.statusCode, response.headers);
        response.on('data', (chunk) => contentSize += chunk.length);
        response.on('end', () => this.emit('end', contentSize));
        this.links = parseLinkHeader([response.headers.link, response.headers['x-amz-meta-link']].join(','));
        if (this.attributes.async) {
            this.asyncStream.write(`<div style="display:none;" id="async-${this.attributes.id}">`);
            response.pipe(this.asyncStream, {end: false});
            response.on('end', () => {
                this.asyncStream.write('</div>');
                this.initAsyncScript();
                this.asyncStream.end();
            });
        } else {
            this.insertLinks();
            if (!this.attributes.inline) {
                this.stream.write(`<div id="${this.attributes.id}">`);
            }
            response.pipe(this.stream, {end: false});
            response.on('end', () => {
                if (!this.attributes.inline) {
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
            this.asyncStream.write(`<link rel="stylesheet" href="${this.links.stylesheet.url}">`);
        }
        this.asyncStream.write(`<script>pipe("${this.attributes.id}", `);
        if (this.links && this.links['fragment-script']) {
            this.asyncStream.write(`"${this.links['fragment-script'].url}"`);
        } else {
            this.asyncStream.write('false');
        }
        this.asyncStream.write(', true)</script>');
    }

};
