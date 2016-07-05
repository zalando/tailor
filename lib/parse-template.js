'use strict';
const Transform = require('./transform');

module.exports = function parseTemplate (insertPipeBeforeTags, optionalTransforms) {
    return (template) => new Promise((resolve, reject) => {
        try {
            const transform = new Transform(insertPipeBeforeTags, optionalTransforms);
            const parsedNodes = transform.applyTransforms(template);
            resolve(parsedNodes);
        } catch (e) {
            reject(e);
        }
    });
};