'use strict';
const url = require('url');

const jsHeaders = {
    'Content-Type': 'application/javascript',
    'Access-Control-Allow-Origin': '*'
};

const defineFn = (module, fragmentName) => {
    return `define (['${module}'], function (module) {
        return function initFragment (element) {
            element.className += ' fragment-${fragmentName}-${module}';
            element.innerHTML += ' ' + module;
        }
    })`;
};

module.exports = (fragmentName, fragmentUrl) => (request, response) => {
    const pathname = url.parse(request.url).pathname;
    switch (pathname) {
        case '/module-1.js':
            // serve fragment's JavaScript
            response.writeHead(200, jsHeaders);
            response.end(defineFn('js1', fragmentName));
            break;
        case '/module-2.js':
            // serve fragment's JavaScript
            response.writeHead(200, jsHeaders);
            response.end(defineFn('js2', fragmentName));
            break;
        case '/fragment.css':
            // serve fragment's CSS
            response.writeHead(200, { 'Content-Type': 'text/css' });
            response.end(`
                .fragment-${fragmentName} {
                    padding: 30px;
                    margin: 10px;
                    text-align: center;
                }
                .fragment-${fragmentName}-js1 {
                    background-color: lightgrey;
                }
                .fragment-${fragmentName}-js2 {
                    color: blue;
                }
            `);
            break;
        default:
            // serve fragment's body
            response.writeHead(200, {
                'Link': `<${fragmentUrl}/fragment.css>; rel="stylesheet",` +
                        `<${fragmentUrl}/module-1.js>; rel="fragment-script",` +
                        `<${fragmentUrl}/module-2.js>; rel="fragment-script"`,
                'Content-Type': 'text/html'
            });
            response.end(`
                <div class="fragment-${fragmentName}">
                    Fragment ${fragmentName}
                </div>
            `);

    }
};
