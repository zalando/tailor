'use strict';
const ParserStream = require('./streams/parser-stream');

module.exports = function parseTemplate (handledTags) {
    return (template) => new Promise((resolve, reject) => {
        const parser = new ParserStream(handledTags);
        if (typeof template === 'string') {
            parser.end(template);
        } else {
            template.pipe(parser);
            template.on('error', reject);
        }
        resolve(parser);
    });
};
