'use strict';

const path = require('path');
const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const requestHandler = require('./lib/request-handler');
const fetchTemplate = require('./lib/fetch-template');
const parseTemplate = require('./lib/parse-template');
const requestFragment = require('./lib/request-fragment');
const PIPE_DEFINITION = fs.readFileSync(path.resolve(__dirname, 'src/pipe.min.js'));
const AMD_LOADER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.1.22/require.min.js';

const stripUrl = fileUrl => path.normalize(fileUrl.replace('file://', ''));

module.exports = class Tailor extends EventEmitter {

    constructor (options) {
        super();
        const { amdLoaderUrl = AMD_LOADER_URL, templatesPath } = options;
        let memoizedDefinition;
        const pipeChunk = (amdLoaderUrl, pipeInstanceName) => {
            if (!memoizedDefinition) {
                // Allow reading from fs for inlining AMD
                if (amdLoaderUrl.startsWith('file://')) {
                    let fileData = fs.readFileSync(stripUrl(amdLoaderUrl), 'utf-8');
                    memoizedDefinition = `<script>${fileData}\n${PIPE_DEFINITION}\n`;
                } else {
                    memoizedDefinition = 
                        `<script src="${amdLoaderUrl}"></script>\n
                        <script>${PIPE_DEFINITION}\n`;
                }
            }
            return new Buffer(memoizedDefinition + `${pipeInstanceName} = new Pipe(require)</script>\n`);
        };

        const requestOptions = Object.assign({
            fetchContext: () => Promise.resolve({}),
            fetchTemplate: fetchTemplate(
                templatesPath ||
                path.join(process.cwd(), 'templates')
            ),
            fragmentTag: 'fragment',
            handledTags: [],
            handleTag: () => '',
            requestFragment,
            pipeDefinition: pipeInstanceName => pipeChunk(amdLoaderUrl, pipeInstanceName),
            pipeInstanceName : () => '_p' + Math.round(Math.random() * 999)
        }, options);

        // TODO: Check if we could decouple this from requestOptions and use object shorthand syntax
        requestOptions.parseTemplate = parseTemplate(
            [requestOptions.fragmentTag].concat(requestOptions.handledTags),
            ['script', requestOptions.fragmentTag]
        );
        
        this.requestHandler = requestHandler.bind(this, requestOptions);
        // To Prevent from exiting the process - https://nodejs.org/api/events.html#events_error_events
        this.on('error', () => {});
    }

};
