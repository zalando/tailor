'use strict';
const Transform = require('./transform');

module.exports = function parseTemplate (handledTags, insertBeforePipeTags) {
    return (baseTemplate, childTemplate) => new Promise((resolve, reject) => {
        try {
            const transform = new Transform(handledTags, insertBeforePipeTags);
            const serializedList = transform.applyTransforms(baseTemplate, childTemplate);
            resolve(serializedList);
        } catch (e) {
            reject(e);
        }
    });
};
