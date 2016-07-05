'use strict';
const stream = require('stream');
const parse5 = require('parse5');
const htmlparser2 = parse5.treeAdapters.htmlparser2;

module.exports = class ASTStream extends stream.Readable {
    constructor(template) {
        super({objectMode: true});
        this.data = template;
    }

    _read() {
        this.push(this.data);
        this.push(null);
    }
};