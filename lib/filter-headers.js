'use strict';
const ACCEPT_REQ_HEADERS = ['accept-language', 'referer', 'user-agent'];
const ACCEPT_RES_HEADERS = ['location', 'set-cookie'];

const filterHeaders = (publicFragment, acceptHeaders, headers) => {
    // Headers are not forwarded to/from public fragments for security reasons
    return publicFragment
        ? {}
        : acceptHeaders.reduce((newHeaders, key) => {
            headers[key] && (newHeaders[key] = headers[key]);
            return newHeaders;
        }, {});
};

module.exports = {
    /**
    * Filter the request headers that are passed to fragment request.
    * @callback filterRequestHeaders
    *
    * @param {Object} attributes - Attributes object of the fragment node
    * @param {string} attributes.public - Denotes the public fragment.
    * @param {Object} request - HTTP request object
    * @param {Object} request.headers - Request header object
    * @returns {Object} New filtered header object
    */
    request: (attributes, request = {}) =>
        filterHeaders(attributes.public, ACCEPT_REQ_HEADERS, request.headers),

    /**
    * Filter the response headers that are passed from fragment request.
    * @callback filterResponseHeaders
    *
    * @param {Object} attributes - Attributes object of the fragment node
    * @param {string} attributes.public - Denotes the public fragment.
    * @param {Object} response - HTTP response object
    * @param {Object} response.headers - Response header object
    * @returns {Object} New filtered header object
    */
    response: (attributes, response = {}) =>
        filterHeaders(attributes.public, ACCEPT_RES_HEADERS, response.headers)
};
