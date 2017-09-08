'use strict';

const http = require('http');
const path = require('path');
const url = require('url');
const processTemplate = require('../../lib/process-template');

const Tailor = require('../../');

const tailor = new Tailor({
    templatesPath: path.join(__dirname, 'templates'),
    handledTags: ['switcher'],
    handleTag: (request, tag, options, context) => {
        if (tag && tag.name === 'switcher') {
            const st = processTemplate(request, options, context);

            const finalSrc = tag.attributes['final-src'];
            http.get(
                `http://localhost:8081/switcher?nesting=${tag.attributes
                    .nesting}&final_src=${finalSrc}`,
                res => {
                    let data = '';
                    res.on('data', chunk => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        options
                            .parseTemplate(data, null, false)
                            .then(parsedTemplate => {
                                parsedTemplate.forEach(item => {
                                    st.write(item);
                                });
                                st.end();
                            });
                    });
                }
            );
            return st;
        }

        return '';
    }
});

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
http
    .createServer((req, res) => {
        const urlObj = url.parse(req.url, true);

        if (urlObj.pathname === '/switcher') {
            res.setHeader('Content-Type', 'text/html');
            const { nesting, final_src } = urlObj.query;
            const currentNesting = parseInt(nesting);

            console.log(
                'Request to switcher with nesting "%s"',
                currentNesting
            );

            if (currentNesting === 0) {
                return res.end(`<fragment src="${final_src}"/>`);
            } else {
                return res.end(`
                <div>Switcher ${currentNesting}</div>
                <switcher nesting=${currentNesting -
                    1} final-src=${final_src} ></switcher>
            `);
            }
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });

        // fragment content
        const name = urlObj.query.name;
        res.end(`<div>Fragment, name: ${name}</div>`);
    })
    .listen(8081, function() {
        console.log('Fragment Server listening on port 8081');
    });
