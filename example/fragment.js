'use strict';
const url = require('url');

module.exports = (fragmentName, fragmentUrl) => (request, response) => {
    const pathname = url.parse(request.url).pathname;
    switch (pathname) {
        case '/fragment.js':
            // serve fragment's JavaScript
            response.writeHead(200, {'Content-Type': 'application/javascript'});
            response.end(`
                define (['word'], function (word) {
                    return function initFragment (element) {
                        element.className += ' fragment-${fragmentName}-initialised';
                        element.innerHTML += word;
                    };
                });
            `);
            break;
        case '/fragment.css':
            // serve fragment's CSS
            response.writeHead(200, {'Content-Type': 'text/css'});
            response.end(`
                .fragment-${fragmentName} {
                    padding: 30px;
                    margin: 10px;
                    text-align: center;
                }
                .fragment-${fragmentName}-initialised {
                    background-color: lightgrey;
                }
            `);
            break;
        default:
            // serve fragment's body
            response.writeHead(200, {
                'Link': `<${fragmentUrl}/fragment.css>; rel="stylesheet",` +
                        `<${fragmentUrl}/fragment.js>; rel="fragment-script"`,
                'Content-Type': 'text/html'
            });
            response.end(`
                <div class="fragment-${fragmentName}">
                    Fragment ${fragmentName}
                </div>
            `);
    }
};
