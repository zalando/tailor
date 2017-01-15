'use strict';
const { compose, pick, omitBy } = require('lodash/fp');

/**
 * Filter the request headers that are passed to fragment request.
 *
 * @param {Object} attributes - Attributes object of the fragment node
 * @param {string} attributes.public - Denotes the public fragemnt. Headers are not forward in this case
 * @param {Object} headers - Request header object
 * @returns {Object} New filtered header object
 */
module.exports = (attributes, headers) => {
    if (attributes.public) {
        return {};
    }

    return compose(
        omitBy(e => !e),
        pick(['accept-language', 'referer', 'user-agent'])
    )(headers);
};
