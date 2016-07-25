'use strict';

const EventEmitter = require('events').EventEmitter;
const requestHandler = require('./lib/request-handler');
const fetchTemplate = require('./lib/fetch-template');
const parseTemplate = require('./lib/parse-template');
const requestFragment = require('./lib/request-fragment');
const path = require('path');
const fs = require('fs');
const PIPE_DEFINITION = fs.readFileSync(path.resolve(__dirname, 'src/pipe.min.js'));
const AMD_LOADER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.1.22/require.min.js';

module.exports = class Tailor extends EventEmitter {

    constructor (options) {
        super();
        const amdLoaderUrl = options.amdLoaderUrl || AMD_LOADER_URL;
        const requestOptions = Object.assign({
            fetchContext: () => Promise.resolve({}),
            fetchTemplate: fetchTemplate(
                options.templatesPath ||
                path.join(process.cwd(), 'templates')
            ),
            fragmentTag: 'fragment',
            handledTags: [],
            handleTag: () => '',
            requestFragment,
            pipeDefinition: (pipeInstanceName) => new Buffer(
                `<script src="${amdLoaderUrl}"></script>\n` +
                `<script>${PIPE_DEFINITION}\n` +
                `${pipeInstanceName} = new Pipe(require)</script>\n`
            ),
            pipeInstanceName : () => '_p' + Math.round(Math.random() * 999)
        }, options);
        requestOptions.parseTemplate = parseTemplate(
            [requestOptions.fragmentTag].concat(requestOptions.handledTags),
            ['script', requestOptions.fragmentTag]
        );
        this.requestHandler = requestHandler.bind(this, requestOptions);
        // To Prevent from exiting the process - https://nodejs.org/api/events.html#events_error_events
        this.on('error', () => {});
    }

};
