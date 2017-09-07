'use strict';

const StringifierStream = require('./streams/stringifier-stream');
const Fragment = require('./fragment');
/**
 * Process the parsed template and handle the composition of fragments in the template
 * using stringifier stream
 *
 * @param {Object} request - HTTP Request object
 * @param {Object} options - Tailor options
 * @param {Object} context - Dynamic overrides for fragments
 *
 * @return {Object} Composition of fragment streams - StringifierStream
 */
module.exports = function processTemplate(request, options, context) {
    const {
        maxAssetLinks,
        asyncStream,
        handleTag,
        requestFragment,
        fragmentTag,
        nextIndex,

        pipeDefinition,
        pipeAttributes,
        pipeInstanceName,
    } = options;

    const resultStream = new StringifierStream((tag) => {
        const { placeholder, name } = tag;

        const fetchFragment = (context) => {
            const fragment = new Fragment({
                tag,
                index: nextIndex(),
                context,
                requestFragment,
                pipeInstanceName,
                pipeAttributes,
                maxAssetLinks
            });

            resultStream.emit('fragment:found', fragment);

            const { async } = fragment.attributes;

            if (async) {
                asyncStream.write(fragment.stream);
            }

            return fragment.fetch(request, false);
        };

        if (placeholder === 'pipe') {
            return pipeDefinition(pipeInstanceName);
        }

        if (placeholder === 'async') {
            // end of body tag
            return asyncStream;
        }

        if (name === fragmentTag) {
            return fetchFragment(context);
        }

        return handleTag(request, tag, options, context);
    });

    return resultStream;
};
