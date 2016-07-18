'use strict';
const Transform = require('./transform');

module.exports = function parseTemplate (insertBeforePipeTags, fragmentTag) {
    return (baseTemplate, childTemplate) => new Promise((resolve, reject) => {
        try {
            const transform = new Transform(insertBeforePipeTags, fragmentTag);
            const serializedNodes = transform.applyTransforms(baseTemplate, childTemplate);
            resolve(serializedNodes);
        } catch (e) {
            reject(e);
        }
    });
};
