'use strict';

const http = require('http');
const https = require('https');
const url = require('url');
// By default tailor supports gzipped response from fragments
const requiredHeaders = {
    'accept-encoding': 'gzip, deflate'
};

/**
 * Simple Request Promise Function that requests the fragment server with
 *  - filtered headers
 *  - Specified timeout from fragment attributes
 *
 * @param {filterHeaders} - Function that handles the header forwarding
 * @param {string} fragmentUrl - URL of the fragment server
 * @param {Object} fragmentAttributes - Attributes passed via fragment tags
 * @param {Object} request - HTTP request stream
 * @returns {Promise} Response from the fragment server
 */
module.exports = filterHeaders => (fragmentUrl, fragmentAttributes, request) =>
    new Promise((resolve, reject) => {
        const parsedUrl = url.parse(fragmentUrl);
        const options = Object.assign(
            {
                headers: Object.assign(
                    filterHeaders(fragmentAttributes, request),
                    requiredHeaders
                ),
                keepAlive: true,
                timeout: fragmentAttributes.timeout
            },
            parsedUrl
        );
        const { protocol: reqProtocol, timeout } = options;
        const protocol = reqProtocol === 'https:' ? https : http;
        const fragmentRequest = protocol.request(options);
        if (timeout) {
            fragmentRequest.setTimeout(timeout, fragmentRequest.abort);
        }
        fragmentRequest.on('response', response => {
            if (response.statusCode >= 500) {
                reject(new Error('Internal Server Error'));
            } else {
                resolve(response);
            }
        });
        fragmentRequest.on('error', reject);
        fragmentRequest.end();
    });
