'use strict';

const http = require('http');
const SIZE = 1024;
const CHARS = '0123456789abcdefghijklmnopqrstuvwxzyABCDEFGHIJKLMNOPQRSTUVWXZY';
const buffer = Buffer.alloc(SIZE);
for (let i = 0; i < SIZE; i++) {
    buffer.write(
        CHARS.charAt(Math.round(Math.random() * (CHARS.length - 1))),
        i
    );
}

http
    .createServer((request, response) => {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.write(buffer);
        response.end();
    })
    .listen(8081);
