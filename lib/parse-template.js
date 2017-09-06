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
    (baseTemplate, childTemplate, fullRendering = true) => {
        return Promise.resolve(new Transform(handledTags, insertBeforePipeTags))
            .then((transform => transform.applyTransforms(baseTemplate, childTemplate, fullRendering)));
    };
