'use strict';

const EventEmitter = require('events').EventEmitter;
const requestHandler = require('./lib/request-handler');
const fetchTemplate = require('./lib/fetch-template');
const parseTemplate = require('./lib/parse-template');
const requestFragment = require('./lib/request-fragment');
const path = require('path');
const fs = require('fs');
const pipeDefinition = fs.readFileSync(path.resolve(__dirname, 'src/pipe.min.js'));


module.exports = class Tailor extends EventEmitter {

    constructor (options) {
        super();
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
            amdLoaderUrl: 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.1.22/require.min.js',
            pipeDefinition: (amdLoaderUrl, pipeDefinition) => new Buffer(
                `<script src="${amdLoaderUrl}"></script>\n` +
                `<script>${pipeDefinition}\nvar p = new Pipe(require);</script>\n`
            )
        }, options);
        requestOptions.pipeDefinition = requestOptions.pipeDefinition(
            requestOptions.amdLoaderUrl,
            pipeDefinition
        );
        requestOptions.parseTemplate = parseTemplate(
            [requestOptions.fragmentTag].concat(requestOptions.handledTags)
        );
        this.requestHandler = requestHandler.bind(this, requestOptions);
        // To Prevent from exiting the process - https://nodejs.org/api/events.html#events_error_events
        this.on('error', () => {});
    }

};

Object.assign(module.exports, {fetchTemplate});
