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
const handleTag = require('./lib/handle-tag');

const stripUrl = (fileUrl) => {
    return path.normalize(fileUrl.replace('file://', ''));
};

module.exports = class Tailor extends EventEmitter {

    constructor (options) {
        super();
        const amdLoaderUrl = options.amdLoaderUrl || AMD_LOADER_URL;
        let memoizedDefinition;
        const pipeChunk = (amdLoaderUrl, pipeInstanceName) => {
            if (!memoizedDefinition) {
                // Allow reading from fs for inlining AMD
                if (amdLoaderUrl.startsWith('file://')) {
                    let fileData = fs.readFileSync(stripUrl(amdLoaderUrl), 'utf-8');
                    memoizedDefinition = `<script>${fileData}\n${PIPE_DEFINITION}\n`;
                } else {
                    memoizedDefinition = `<script src="${amdLoaderUrl}"></script>\n` +
                    `<script>${PIPE_DEFINITION}\n`;
                }
            }
            return new Buffer(memoizedDefinition + `${pipeInstanceName} = new Pipe(require)</script>\n`);
        };
        const requestOptions = Object.assign({
            fetchContext: () => Promise.resolve({}),
            fetchTemplate: fetchTemplate(
                options.templatesPath ||
                path.join(process.cwd(), 'templates')
            ),
            fragmentTag: 'fragment',
            handledTags: ['service-worker'],
            handleTag,
            requestFragment,
            pipeDefinition: (pipeInstanceName) => pipeChunk(amdLoaderUrl, pipeInstanceName),
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
