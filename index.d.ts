/// <reference types="node" />

import { EventEmitter } from "events";
import { Stream } from "stream";
import { Url } from "url";
import { IncomingMessage, ServerResponse } from "http";

export = Tailor;

declare class Tailor extends EventEmitter {
  /**
   * Creates new instance of Tailor
   * @param options Parameters to pass to Tailor
   * @param options.amdLoaderUrl URL to AMD loader. Default is RequireJS from cdnjs.
   * @param options.fetchContext Function that should fetch the template, call parseTemplate and return a promise of the result. Useful to implement your own way to retrieve and cache the templates. Default implementation: serve templates from local path
   * @param options.fetchTemplate  Function that should fetch the template, call parseTemplate and return a promise of the result
   * @param options.filterRequestHeaders Function that filters the request headers that are passed to fragment request
   * @param options.filterResponseHeaders Function that maps the given response headers from the primary fragment request to the final response
   * @param options.fragmentTag Name of fragment tag
   * @param options.handleTags Array of custom tags.
   * @param options.handleTag Receives a tag or closing tag and serializes it to a string or returns as stream
   * @param options.maxAssetLinks Number of allowed link headers of CSS and JS for per fragment
   * @param options.pipeAttributes Function that returns the minimal set of fragment attributes available on the frontend 
   * @param options.pipeInstanceName  Name of pipe instance that available in the browser window object to consume frontend hooks
   * @param options.requestFragment Function that returns a promise of request to a fragment server
   * @param options.templatesPath Path to local templates
   */
  constructor(options?: {
    amdLoaderUrl?: string
    , fetchContext?: (req: IncomingMessage) => Promise<object>
    , fetchTemplate?: (templatesPath: string, baseTemplateFn: (path: string) => string) => Promise<any>
    , filterRequestHeaders?: (attributes: object, req: IncomingMessage) => object
    , filterResponseHeaders?: (attributes: object, req: ServerResponse) => object
    , fragmentTag?: string
    , handledTags?: string[]
    , handleTag?: (request: IncomingMessage, tag: object, options: object, context: object) => Stream | string
    , maxAssetLinks?: number
    , pipeAttributes?: (attributes: object) => object
    , pipeInstanceName?: string
    , requestFragment?: (filterHeaders: (attributes: object, req: IncomingMessage) => object, url: Url, attributes: object, req: IncomingMessage) => Promise<IncomingMessage>
    , templatesPath?: string
  })

  requestHandler(request: IncomingMessage, response: ServerResponse): void;
}


