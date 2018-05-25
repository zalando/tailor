'use strict';

const opentracing = require('opentracing');

/**
 * Sets the given tracer and the Opentracing global tracer
 *
 * @param {Object} implementation - An Opentracing compliant Tracer implementation
 * @see {@link https://doc.esdoc.org/github.com/opentracing/opentracing-javascript/class/src/tracer.js~Tracer.html}
 */
module.exports = {
    initTracer: function(implementation) {
        opentracing.initGlobalTracer(
            implementation || new opentracing.Tracer()
        );
    }
};
