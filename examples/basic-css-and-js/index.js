'use strict';

const http = require('http');
const buildBlock = require('../../lib/block').buildBlock;

const Tailor = require('../../');

const tailor = new Tailor({
    templatesPath: __dirname + '/templates',
    handledTags: ['smart-fragment'],
    handleTag: (request, context, tag) => {
        if (tag && tag.name === 'smart-fragment') {
            const st = buildBlock(request, context);

            http.get(`http://localhost:8081/smart-fragment?level=${tag.attributes.level}`, (res) => {
                // TODO: use?
                let data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    context.parseTemplate(data, null, false).then(parsedTemplate => {
                        parsedTemplate.forEach((item) => {
                            st.write(item);
                        });
                        st.end();
                    });
                });
            });

            st.on('end', () => {
            });

            return st;
        }


        return '';
    }
});

// Root Server
http.createServer((req, res) => {
    if (req.url === '/favicon.ico') {
        res.writeHead(200, { 'Content-Type': 'image/x-icon' } );
        return res.end('');
    }
    tailor.requestHandler(req, res);
}).listen(8080, function () {
    console.log('Tailor server listening on port 8080');
});

// Fragment server - Any http server that can serve fragments
http.createServer((req, res) => {
    // just some js
    if (req.url === '/script.js') {
        res.setHeader('Content-Type', 'application/javascript');
        return res.end('c=!setInterval(\'document.getElementById("c").innerHTML=c++;\', 1e3)');
    }

    // and some css
    if (req.url === '/styles.css') {
        res.setHeader('Content-Type', 'text/css');
        return res.end('body { background: #303F9F; color: white }');
    }
    const urlObj = require('url').parse(req.url, true);

    if (urlObj.pathname === '/smart-fragment') {
        res.setHeader('Content-Type', 'text/html');

        if (urlObj.query.level === '1') {
            return res.end('<smart-fragment level="2"></smart-fragment>');
        } else {
            return res.end('<fragment src="http://localhost:8081/nested-tag?index=2"/><fragment src="http://localhost:8081/nested-tag?index=0"/>');
        }

    }

    if (urlObj.pathname === '/broken') {
        res.writeHead(500);
        return res.end();
    }


    if (urlObj.pathname === '/nested-tag') {
        res.writeHead(200);
        return res.end(`Nested tag ${urlObj.query.index || 0}!`);
    }

    // Every Fragment sends a link header that describes its resources - css and js
    const css = '<http://localhost:8081/styles.css>; rel="stylesheet"';
    // this will be fetched using require-js as an amd module
    const js = '<http://localhost:8081/script.js>; rel="fragment-script"';

    res.writeHead(200, {
        Link: `${css}, ${js}`,
        'Content-Type': 'text/html',
    });

    // fragment content
    res.end('<div>Fragment 1: <span id=\'c\'>-1</span>s elapsed</div>');
}).listen(8081, function () {
    console.log('Fragment Server listening on port 8081');
});
