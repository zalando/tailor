'use strict';

const http = require('http');
const Tailor = require('../../');
const tailor = new Tailor({
    templatesPath: __dirname + '/templates'
});

const createFragment = (http, port) => {
    http
        .createServer((req, res) => {
            // just some js
            if (req.url === '/script.js') {
                res.setHeader('Content-Type', 'application/javascript');
                return res.end(
                    `
                        c=!setInterval(\'document.getElementById("c${port}").innerHTML=c++;\', 1e3);
                        document.getElementById("f${port}").style["background-color"] = "green";
                    `
                );
            }

            // and some css
            if (req.url === '/styles.css') {
                res.setHeader('Content-Type', 'text/css');
                return res.end('.fragment { margin: 20px 0; height: 300px }');
            }

            // Every Fragment sends a link header that describes its resources - css and js
            const css = `<http://localhost:${port}/styles.css>; rel="stylesheet"`;
            // this will be fetched using require-js as an amd module
            const js = `<http://localhost:${port}/script.js>; rel="fragment-script"`;

            res.writeHead(200, {
                Link: `${css}, ${js}`,
                'Content-Type': 'text/html'
            });

            // fragment content
            res.end(
                `<div id="f${port}" class="fragment" style="background-color: grey;">Fragment Port ${port}: <span id="c${port}">-1</span>s elapsed</div>`
            );
        })
        .listen(port, function() {
            console.log(`Fragment Server listening on port ${port}`);
        });
};

// Root Server
http
    .createServer((req, res) => {
        if (req.url === '/favicon.ico') {
            res.writeHead(200, { 'Content-Type': 'image/x-icon' });
            return res.end('');
        }
        tailor.requestHandler(req, res);
    })
    .listen(8080, function() {
        console.log('Tailor server listening on port 8080');
    });

// Fragment server - Any http server that can serve fragments
createFragment(http, 8081);
createFragment(http, 8082);
createFragment(http, 8083);
