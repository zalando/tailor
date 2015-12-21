'use strict';

const http = require('http');
const https = require('https');


module.exports = function requestFragment (options) {
    return new Promise((resolve, reject) => {
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
