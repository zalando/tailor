'use strict';

const parseLinkHeader = require('parse-link-header');
const fs = require('fs');
const path = require('path');

module.exports = class SWHelper {

    constructor() {
        this.assetStream = [];
        this.fragments = [];
    }

    onFragmentResponse(request, fragment, statusCode, headers) {
        const links = parseLinkHeader([headers.link].join(''));
        if (links.stylesheet && links.stylesheet.url) {
            this.fragments.push(links.stylesheet.url);
        }
        if (links['fragment-script'] && links['fragment-script'].url) {
            this.fragments.push(links['fragment-script'].url);
        }
    }

    pushInstall() {
        return `let cacheName = 'tailor';
        self.addEventListener('install', function (event) {
            self.skipWaiting();
            event.waitUntil(
                caches.open(cacheName).then(function (cache) {
                    return cache.addAll(assets);
                })
            );
        });`;
    }

    pushActivate() {
        return `self.addEventListener('activate', function (event) {

        });`;
    }

    pushFetch() {
        return `self.addEventListener('fetch', function (event) {
            const request = event.request.clone();
            event.respondWith(
                fetch(request)
                    .then(function (response) {
                        caches.open(cacheName).then(function (cache) {
                            cache.put(request, response);
                        });
                        return response.clone();
                    })
                    .catch(function (err) {
                        return caches.match(request);
                    })
            )
        });`;
    }

    createSWScript() {
        this.assetStream.push(
            'let assets = ['
            + [...this.fragments.sort((a,b) => a>b)].map(a=>JSON.stringify(a)).join(',')
            + '];\n'
        );
        this.assetStream.push(this.pushInstall());
        this.assetStream.push(this.pushActivate());
        this.assetStream.push(this.pushFetch());

        this.assetStream.unshift('let CACHEVERSION = '
            + JSON.stringify(new Buffer(this.assetStream.join(''), 'utf-8').toString('base64')).substr(0, 10)
            + ';\n'
        );

        const newSw = this.assetStream.join('');
        const oldSW = fs.readFileSync(path.join(__dirname, 'assets.js'), 'utf-8');
        if (newSw !== oldSW) {
            fs.writeFileSync(path.join(__dirname, 'assets.js'), newSw, {encoding: 'utf-8'});
        }
    }

};
