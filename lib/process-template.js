'use strict';

const StringifierStream = require('./streams/stringifier-stream');
const Fragment = require('./fragment');

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

            const { attributes: { async, primary } } = fragment;

            if (async) {
                asyncStream.write(fragment.stream);
            }

            if (primary) {
                resultStream.emit('primary:found', fragment);
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
