'use strict';
const http = require('http');
const path = require('path');
const Tailor = require('../index');
const tailor = new Tailor({
    templatesPath: path.join(__dirname, 'templates')
});
const server = http.createServer(tailor.requestHandler);
server.listen(process.env.PORT || 8080);
