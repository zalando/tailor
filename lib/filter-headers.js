'use strict';

module.exports = function filterHeaders (attributes, headers) {
    const newHeaders = {};
    if (attributes.public) {
        return newHeaders;
    };
    ['accept-language', 'referer', 'user-agent'].forEach((key) => {
        if (headers[key]) {
            newHeaders[key] = headers[key];
        }
    });
    return newHeaders;
};
