'use strict';

module.exports = function filterHeaders (headers) {
    const newHeaders = {};
    ['accept-language', 'referer', 'user-agent'].forEach((key) => {
        if (headers[key]) {
            newHeaders[key] = headers[key];
        }
    });
    return newHeaders;
};
