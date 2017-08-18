'use strict';

const stream = require('stream');
const { PassThrough } = stream;
const StringifierStream = require('./streams/stringifier-stream');
const Fragment = require('./fragment');
const FRAGMENT_EVENTS = ['start', 'response', 'end', 'error', 'timeout', 'fallback', 'warn'];

// context -> quilt context -> fragment overrides
// request -> original request info
module.exports.buildBlock = function buildBlock(request, originalContext) {
    // NOTE: should there be a separation between context as something global
    // vs. context as quilt/tailor-specific term?
    let context = originalContext;

    const resultStream = new StringifierStream((tag) => {

        const {
            maxAssetLinks,
            asyncStream,
            handleTag,
            requestFragment,

            // Should the two below be one???
            pipeDefinition,
            pipeAttributes,
            pipeInstanceName,


            dynamicContextAttribute,
            fetchDynamicContext
        } = context;

        const { placeholder, name } = tag;

        const fetchFragment = (combinedContext) => {
            const fragment = new Fragment({
                tag,
                context: combinedContext,
                index: combinedContext.index,
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

            const isAsync = fragment.attributes.async;
            const isPrimary = fragment.attributes.primary;

            if (isAsync) {
                asyncStream.write(fragment.stream);
            }

            if (isPrimary) {
                resultStream.emit('primary:found', fragment);
            }

            return fragment.fetch(request, false);
        };

        if (placeholder === 'pipe') {
            return pipeDefinition(pipeInstanceName);
        }

        if (asyncStream && placeholder === 'async') {
            // end of body tag
            return asyncStream;
        }

        if (name === 'fragment') {
            // Freeze current context & update the indexes
            const fragmentContext = context;
            context = Object.assign({}, context, {
                index: context.index + maxAssetLinks
            });
            resultStream.emit('fragment:found');

            const shouldFetchDynamicContext = dynamicContextAttribute
                && tag.attributes
                && (typeof tag.attributes[dynamicContextAttribute] !== 'undefined');

            if (shouldFetchDynamicContext) {
                const tempStream = new PassThrough({
                    objectMode: true
                });

                const pipeFragmentResult = result => {
                    if (result instanceof stream) {
                        result.pipe(tempStream);
                    } else {
                        tempStream.end(result);
                    }
                };

                fetchDynamicContext(tag)
                    .then(dynamicContext => {
                        const combinedContext = Object.assign({}, fragmentContext, dynamicContext);
                        pipeFragmentResult(fetchFragment(combinedContext));
                    })
                    .catch(() => {
                        pipeFragmentResult(fetchFragment(fragmentContext));
                    });

                return tempStream;
            }

            return fetchFragment(fragmentContext);
        }

        // `handleTag` has an opportunity to modify the context,
        // it's optional
        let result, newContext;
        try {
            result = handleTag(request, context, tag);
            if (Array.isArray(result)) {
                [result, newContext] = result;
            }
            context = newContext ? newContext : context;
        } catch (error) {
            console.error(error);
        }

        if (result instanceof stream) {
            // NOTE: DANGER!
            // So far dunno another way to update index in async fashion
            result.on('fragment:found', () => {
                resultStream.emit('fragment:found');

                context = Object.assign({}, context, {
                    index: context.index + maxAssetLinks
                });
            });
        }


        return result || '';
    });

    return resultStream;
};
