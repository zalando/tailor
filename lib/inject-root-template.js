/**
 * A wrapper to inject a template as root template.
 */


'use strict';


/**
 * MODULES.
 */
const url = require('url');


/**
 * FUNCTION.
 */
const injectRootTemplate = (rootTemplate, handler) => {
    return (request, parseTemplate) => {
        const urlObj = url.parse(request.url, true);
        if (urlObj.pathname.length === 1) {
            urlObj.pathname = rootTemplate;
        }
        request.url = url.format(urlObj);
        return handler(request, parseTemplate);
    };
};


/**
 * EXPORTS.
 */
module.exports = injectRootTemplate;