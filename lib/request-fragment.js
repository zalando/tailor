'use strict';

const http = require('http');
const https = require('https');
const url = require('url');

module.exports = function requestFragment (fragmentAttributes, headers) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(fragmentAttributes.url);
        const options = Object.assign({
            headers: headers,
            keepAlive: true,
            timeout: fragmentAttributes.timeout
        }, parsedUrl);

        const protocol = options.protocol === 'https:' ? https : http;
        const request = protocol.request(options);
        if (options.timeout) {
            request.setTimeout(options.timeout, () => request.abort());
        }
        request.on('response', (response) => resolve(response));
        request.on('error', (e) => reject(e));
        request.end();
    });
};
