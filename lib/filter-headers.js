'use strict';
const ACCEPT_HEADERS = ['accept-language', 'referer', 'user-agent'];
/**
 * Filter the request headers that are passed to fragment request.
 * @callback filterHeaders
 *
 * @param {Object} attributes - Attributes object of the fragment node
 * @param {string} attributes.public - Denotes the public fragment.
 * @param {Object} request - HTTP Request object
 * @param {Object} request.headers - request header object
 * @returns {Object} New filtered header object
 */
module.exports = (attributes, request) => {
    const { public: publicFragment } = attributes;
    const { headers = {} } = request;
    // Headers are not forwarded to public fragment for security reasons
    return publicFragment
        ? {}
        : ACCEPT_HEADERS.reduce((newHeaders, key) => {
              headers[key] && (newHeaders[key] = headers[key]);
              return newHeaders;
          }, {});
};
