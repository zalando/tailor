'use strict';
const TransformStream = require('stream').Transform;
const http = require('http');
const https = require('https');
const url = require('url');
const parseLinkHeader = require('parse-link-header');

function requestHead(fragmentUrl) {
    return new Promise((resolve, reject) => {
        const urlObj = Object.assign(url.parse(fragmentUrl), { method: 'HEAD', keepAlive: true });
        const protocol = urlObj.protocol === 'https:' ? https : http;
        const fragmentRequest = protocol.request(urlObj);
        fragmentRequest.on('response', (res) => {
            resolve(res.headers);
        });
        fragmentRequest.on('error', (e) => reject(e));
        fragmentRequest.end();
    });
};

function getPreloadLinks(links) {
    const preloadLinks = [];
    Object.keys(links).forEach((key) => {
        const value = links[key];
        const type = (value.rel === 'stylesheet') ? 'style' : 'script';
        preloadLinks.push(`<${value.url}>;rel=preload;as=${type}`);
    });
    return preloadLinks;
}

module.exports = class PreloadStream extends TransformStream {
    constructor(tag) {
        super({objectMode: true});
        this.tag = tag;
        this.queue = [];
        this.Busy = false;
        this.Finished = false;
    }

    next() {

        if (this.Busy) {
            return;
        }

        if (this.queue.length === 0) {
            if (this.Finished) {
                this.emit('alldone');
            }
            return;
        }
        const fragment = this.queue.shift();
        if (fragment) {
            const fragmentUrl = fragment.attributes.src;
            const isAsync = fragment.attributes.async !== undefined;
            if (!isAsync) {
                this.Busy = true;
                requestHead(fragmentUrl)
                    .then((headers) => {
                        const links = parseLinkHeader(headers.link);
                        this.push({links: getPreloadLinks(links)});
                        this.Busy = false;
                        this.next();
                    }).catch(() => this.emit('alldone'));
                // Dont wait - process next
                this.push(fragment);
                this.next();
            } else {
                this.push(fragment);
                this.next();
            }
        }
    }

    _transform(chunk, enc, done) {
        if (chunk.name === this.tag) {
            this.queue.push(chunk);
        } else {
            this.push(chunk);
        }
        this.next();
        done();
    }

    _flush(done) {
        this.Finished = true;
        this.on('alldone', () => {
            if (!this.Busy) {
                console.log('All Done');
                done();
            }
        });
    }
};
