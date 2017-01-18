'use strict';

const path = require('path');
const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const requestHandler = require('./lib/request-handler');
const fetchTemplate = require('./lib/fetch-template');
const parseTemplate = require('./lib/parse-template');
const requestFragment = require('./lib/request-fragment');
const filterHeadersFn = require('./lib/filter-headers');
const PIPE_DEFINITION = fs.readFileSync(path.resolve(__dirname, 'src/pipe.min.js'));
const AMD_LOADER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.1.22/require.min.js';


const stripUrl = (fileUrl) => path.normalize(fileUrl.replace('file://', ''));
const getPipeAttributes = (attributes) => {
    const { primary, id } = attributes;
    return {
        primary: !!(primary || primary === ''),
        id
    };
};

module.exports = class Tailor extends EventEmitter {

    constructor (options) {
        super();
        const { amdLoaderUrl = AMD_LOADER_URL, templatesPath, filterHeaders = filterHeadersFn } = options;
        let memoizedDefinition;
        const pipeChunk = (amdLoaderUrl, pipeInstanceName) => {
            if (!memoizedDefinition) {
                // Allow reading from fs for inlining AMD
                if (amdLoaderUrl.startsWith('file://')) {
                    let fileData = fs.readFileSync(stripUrl(amdLoaderUrl), 'utf-8');
                    memoizedDefinition = `<script>${fileData}\n`;
                } else {
                    memoizedDefinition = `<script src="${amdLoaderUrl}"></script>\n<script>`;
                }
            }
            return new Buffer(`${memoizedDefinition}var ${pipeInstanceName}=${PIPE_DEFINITION}</script>\n`);
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
            requestFragment: requestFragment(filterHeaders),
            pipeInstanceName: 'Pipe',
            pipeDefinition: pipeChunk.bind(null, amdLoaderUrl),
            pipeAttributes: getPipeAttributes
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
