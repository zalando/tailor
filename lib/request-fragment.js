'use strict';

const http = require('http');
const https = require('https');
const url = require('url');
const filterHeaders = require('./filter-headers');
const requiredHeaders = {
    'accept-encoding': 'gzip, deflate'
};

module.exports = function requestFragment (fragmentUrl, fragmentAttributes, request) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(fragmentUrl);
        const options = Object.assign({
            headers: Object.assign(
                filterHeaders(fragmentAttributes, request.headers),
                requiredHeaders
            ),
            keepAlive: true,
            timeout: fragmentAttributes.timeout
        }, parsedUrl);
        const protocol = options.protocol === 'https:' ? https : http;
        const fragmentRequest = protocol.request(options);
        if (options.timeout) {
            fragmentRequest.setTimeout(options.timeout, () => fragmentRequest.abort());
        }
        fragmentRequest.on('response', (response) => {
            if (response.statusCode >= 500) {
                reject(new Error('Internal Server Error'));
            } else {
                resolve(response);
            }
        });
        fragmentRequest.on('error', (e) => reject(e));
        fragmentRequest.end();
    });
};
