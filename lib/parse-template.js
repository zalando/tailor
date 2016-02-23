'use strict';
const ParserStream = require('./streams/parser-stream');

module.exports = function parseTemplate (handledTags, insertPipeBeforeTags) {
    return (template) => new Promise((resolve) => {
        const parser = new ParserStream(handledTags, insertPipeBeforeTags);
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
