'use strict';

const path = require('path');
const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const requestHandler = require('./lib/request-handler');
const fetchTemplate = require('./lib/fetch-template');
const parseTemplate = require('./lib/parse-template');
const requestFragment = require('./lib/request-fragment');
const PIPE_DEFINITION = fs.readFileSync(path.resolve(__dirname, 'src/pipe.min.js'));

module.exports = class Tailor extends EventEmitter {

    constructor (options) {
        super();
        const pipeChunk = (amdLoaderUrl, pipeInstanceName) => {
            let definition;
            if (amdLoaderUrl.startsWith('http')) {
                definition = `<script src="${amdLoaderUrl}"></script>\n` +
                `<script>${PIPE_DEFINITION}\n`;
            } else {
                definition = `<script>${amdLoaderUrl};${PIPE_DEFINITION}\n`;
            }
            return new Buffer(definition + `${pipeInstanceName} = new Pipe(require)</script>\n`);
        };
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
            pipeDefinition: (pipeInstanceName) => pipeChunk(options.amdLoaderUrl, pipeInstanceName),
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
