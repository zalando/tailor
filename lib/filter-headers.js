'use strict';

const ACCEPT_HEADERS = ['accept-language', 'referer', 'user-agent'];
/**
 * Filter the request headers that are passed to fragment request.
 *
 * @param {Object} attributes - Attributes object of the fragment node
 * @param {string} attributes.public - Denotes the public fragemnt. Headers are not forward in this case
 * @param {Object} headers - Request header object
 * @returns {Object} New filtered header object
 */
module.exports = ({ public: publicFragment }, headers) => 
    publicFragment 
        ? {} 
        : ACCEPT_HEADERS.reduce((newHeaders, key) => {
            headers[key] && (newHeaders[key] = headers[key]);
            return newHeaders;
        }, {});
