'use strict';

module.exports = url => {
    const percentRegEx = /\{([^}]+)\}/;
    const matches = percentRegEx.exec(url);
    return matches != null && Object.keys(process.env).includes(matches[1])
        ? url.replace(matches[0], process.env[matches[1]])
        : url;
};
