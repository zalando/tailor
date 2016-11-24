'use strict';

/**
 * ServiceWorker handler and capturer
 */

const _parseLinkHeader = require('parse-link-header');

const CSS_KEY = 'CSS_KEY';
const JS_KEY = 'JS_KEY';

module.exports = {
    handler,
    captureContent
};

function captureContent(store, link) {
    const links = _parseLinkHeader(link);
    const css = [], js = [];
    if (links.stylesheet && links.stylesheet.url) {
        css.push(links.stylesheet.url);
    }
    if (links['fragment-script'] && links['fragment-script'].url) {
        js.push(links['fragment-script'].url);
    }
    return saveContent(store, { css, js });
}

function saveContent(store, data) {
    const update = {
        css: actual => store.set(CSS_KEY, [...actual, ...data.css]),
        js: actual => store.set(JS_KEY, [...actual, ...data.js])
    };

    const createOrReplace = {
        css: store.get(CSS_KEY)
            .then(
                actual => update.css(actual),
                () => update.css([])
            ),
        js: store.get(JS_KEY)
            .then(
                actual => update.js(actual),
                () => update.js([])
            )
    };

    return Promise.all([
        createOrReplace.css, createOrReplace.js
    ]);
}

function handler(options, request, response) {
    if (!isObject(options.serviceWorker)) {
        return respondNotEnabled(response);
    }

    response.writeHead(200, {
        'Content-Type': 'application/javascript'
    });

    let cssVarName, jsVarName;
    if (!options.serviceWorker.varNames) {
        cssVarName = options.serviceWorker.varNames.css
            ? options.serviceWorker.varNames.css
            : 'CSS';
        jsVarName = options.serviceWorker.varNames.js
            ? options.serviceWorker.varNames.js
            : 'JS';
    } else {
        [cssVarName, jsVarName] = ['CSS', 'JS'];
    }

    const {store} = options;

    return Promise.all([
        store.get(CSS_KEY),
        store.get(JS_KEY)
    ]).then(([css, js]) => {
        const temp = `
            var ${cssVarName} = ${css};
            var ${jsVarName} = ${js};
            ${options.serviceWorker.contents}
        `;
        console.log(temp);
        response.end(temp);
    });
}

function isObject(o) {
    return !Array.isArray(o) && typeof o === 'object' && o !== null;
}

function respondNotEnabled(response) {
    response.writeHead(500, {
        'Content-Type': 'text/html'
    });
    response.end('Service Worker is not enabled');
}
