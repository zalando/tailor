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

const defineFnPromise = (module, fragmentName) => {
    return `define (['${module}'], function (module) {
        return function initFragment (element) {
            // Lazy rendering on fragment
            return new Promise((res, rej) => {
                setTimeout(() => {
                    element.className += ' fragment-${fragmentName}-${module}';
                    element.innerHTML += ' ' + module;
                    return res();
                }, 200)
            })
        }
    })`;
};

module.exports = (fragmentName, fragmentUrl, modules = 1, delay = false) => (
    request,
    response
) => {
    const pathname = url.parse(request.url).pathname;
    switch (pathname) {
        case '/module-1.js':
            if (delay) {
                return setTimeout(() => {
                    response.writeHead(200, jsHeaders);
                    response.end(defineFn('js1', fragmentName));
                }, 500);
            } else {
                response.writeHead(200, jsHeaders);
                response.end(defineFn('js1', fragmentName));
            }
            break;
        case '/module-2.js':
            response.writeHead(200, jsHeaders);
            response.end(defineFnPromise('js2', fragmentName));
            break;
        case '/module-3.js':
            response.writeHead(200, jsHeaders);
            response.end(defineFn('js3', fragmentName));
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
                .fragment-${fragmentName}-js3 {
                    text-decoration: underline
                }
            `);
            break;
        default:
            const moduleLinks = [];

            for (var i = 0; i < modules; i++) {
                moduleLinks[i] = `<${fragmentUrl}/module-${i +
                    1}.js>; rel="fragment-script"`;
            }
            // serve fragment's body
            response.writeHead(200, {
                Link: `<${fragmentUrl}/fragment.css>; rel="stylesheet",${moduleLinks.join(
                    ','
                )}`,
                'Content-Type': 'text/html'
            });
            response.end(`
                <div class="fragment-${fragmentName}">
                    Fragment ${fragmentName}
                </div>
            `);
    }
};
