'use strict';

const EventEmitter = require('events').EventEmitter;
const requestHandler = require('./lib/request-handler');
const filterHeaders = require('./lib/filter-headers');
const fetchTemplate = require('./lib/fetch-template');
const parseTemplate = require('./lib/parse-template');
const requestFragment = require('./lib/request-fragment');
const path = require('path');

module.exports = class Tailor extends EventEmitter {

    constructor (options) {
        super();
        const requestOptions = Object.assign({
            filterHeaders: filterHeaders,
            fetchContext: () => Promise.resolve({}),
            fetchTemplate: fetchTemplate(
                options.templatesPath ||
                path.join(process.cwd(), 'templates')
            ),
            fragmentTag: 'fragment',
            handledTags: [],
            handleTag: () => '',
            forceSmartPipe: () => false,
            requestFragment: requestFragment
        }, options);
        requestOptions.parseTemplate = parseTemplate(
            [requestOptions.fragmentTag].concat(requestOptions.handledTags)
        );
        this.requestHandler = requestHandler.bind(this, requestOptions);
    }

};

Object.assign(module.exports, {
    fetchTemplate: fetchTemplate
});
