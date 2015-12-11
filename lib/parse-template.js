'use strict';
const ParserStream = require('./streams/parser-stream');

module.exports = function parseTemplate (handledTags) {
    return (template) => new Promise((resolve) => {
        const parser = new ParserStream(handledTags);
        if (typeof template === 'string') {
            parser.end(template);
        } else {
            template.on('error', (error) => {
                parser.emit('error', error);
            });
            template.pipe(parser);
        }
        resolve(parser);
    });
};
