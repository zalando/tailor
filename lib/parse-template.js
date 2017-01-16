'use strict';
const Transform = require('./transform');

/**
 * Parse both base and child templates
 *
 * @param {Array} handledTags - Tags that should be treated specially and will be handled in the future
 * @param {Array} insertBeforePipeTags - Pipe definition will be inserted before these tags
 * @returns {Promise} Promise that resolves to serialized array consisits of buffer and fragment objects
 */
module.exports = (handledTags, insertBeforePipeTags) =>
    (baseTemplate, childTemplate) => new Promise(resolve => {
        const transform = new Transform(handledTags, insertBeforePipeTags);
        const serializedList = transform.applyTransforms(baseTemplate, childTemplate);
        resolve(serializedList);
    });
