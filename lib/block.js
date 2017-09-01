'use strict';

const stream = require('stream');
const StringifierStream = require('./streams/stringifier-stream');
const Fragment = require('./fragment');
const FRAGMENT_EVENTS = ['start', 'response', 'end', 'error', 'timeout', 'fallback', 'warn'];

module.exports.buildBlock = function buildBlock(request, originalContext) {
    // NOTE: should there be a separation between context as something global
    // vs. context as quilt/tailor-specific term?
    let context = originalContext;

    const {
        maxAssetLinks,
        asyncStream,
        handleTag,
        requestFragment,

        pipeDefinition,
        pipeAttributes,
        pipeInstanceName,
    } = context;

    const resultStream = new StringifierStream((tag) => {
        const { placeholder, name } = tag;

        const fetchFragment = (context, index) => {
            const fragment = new Fragment({
                tag,
                index,
                context,
                requestFragment,
                pipeInstanceName,
                pipeAttributes,
                maxAssetLinks
            });

            FRAGMENT_EVENTS.forEach((eventName) => {
                fragment.on(eventName, (...args) => {
                    const prefixedName = 'fragment:' + eventName;
                    resultStream.emit(prefixedName, request, fragment.attributes, ...args);
                });
            });

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

        if (name === 'fragment') {
            // Remember current index & update the "global" one
            const index = context.index;
            context.index += maxAssetLinks;
            resultStream.emit('fragment:found');

            return fetchFragment(context, index);
        }

        let result = handleTag(request, context, tag);

        if (result instanceof stream) {
            result.on('fragment:found', () => {
                resultStream.emit('fragment:found');

                context.index += maxAssetLinks;
            });
        }

        return result || '';
    });

    return resultStream;
};
