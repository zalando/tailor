<h1><img width="500" height="200" alt="Tailor" src="https://rawgithub.com/zalando/tailor/master/logo/tailor-logo.svg"></h1>

[![NPM](https://nodei.co/npm/node-tailor.png)](https://npmjs.org/package/node-tailor)
[![Build Status](https://travis-ci.org/zalando/tailor.svg?branch=master)](https://travis-ci.org/zalando/tailor)
[![Test Coverage](https://codecov.io/github/zalando/tailor/coverage.svg?precision=0)](https://codecov.io/github/zalando/tailor)

## npm status

[![downloads](https://img.shields.io/npm/dt/node-tailor.svg)](https://npmjs.org/package/node-tailor)
[![version](https://img.shields.io/npm/v/node-tailor.svg)](https://npmjs.org/package/node-tailor)

Tailor is a layout service that uses streams to compose a web page from fragment services. O'Reilly describes it in the title of [this blog post](https://www.oreilly.com/ideas/better-streaming-layouts-for-frontend-microservices-with-tailor) as "a library that provides a middleware which you can integrate into any Node.js server." It's partially inspired by Facebook’s [BigPipe](https://www.facebook.com/notes/facebook-engineering/bigpipe-pipelining-web-pages-for-high-performance/389414033919/), but developed in an ecommerce context.

Some of Tailor's features and benefits:

* **Composes pre-rendered markup on the backend**. This is important for SEO and fastens the initial render.
* **Ensures a fast Time to First Byte**. Tailor requests fragments in parallel and streams them as soon as possible, without blocking the rest of the page.
* **Enforces performance budget**. This is quite challenging otherwise, because there is no single point where you can control performance.
* **Fault Tolerance**. Render the meaningful output, even if a page fragment has failed or timed out.

Tailor is part of [Project Mosaic](https://www.mosaic9.org/), which aims to help developers create microservices for the frontend. The Mosaic also includes an extendable HTTP router for service composition ([Skipper](https://github.com/zalando/skipper)) with related RESTful API that stores routes ([Innkeeper](https://github.com/zalando/innkeeper)); more components are in the pipeline for public release. If your front-end team is making the monolith-to-microservices transition, you might find Tailor and its available siblings beneficial.

## Why a Layout Service?

Microservices get a lot of traction these days. They allow multiple teams to work independently from each other, choose their own technology stacks and establish their own release cycles. Unfortunately, frontend development hasn’t fully capitalized yet on the benefits that microservices offer. The common practice for building websites remains “the monolith”: a single frontend codebase that consumes multiple APIs.

What if we could have microservices on the frontend? This would allow frontend developers to work together with their backend counterparts on the same feature and independently deploy parts of the website — “fragments” such as Header, Product, and Footer. Bringing microservices to the frontend requires a layout service that composes a website out of fragments. Tailor was developed to solve this need.

## Installation

Begin using Tailor with:

```sh
npm i node-tailor --save
```

```javascript
const http = require('http');
const Tailor = require('node-tailor');
const tailor = new Tailor({/* Options */});
const server = http.createServer(tailor.requestHandler);
server.listen(process.env.PORT || 8080);
```

## Options

* `fetchContext(request)` - Function that returns a promise of the context, that is an object that maps fragment id to fragment url, to be able to override urls of the fragments on the page, defaults to `Promise.resolve({})`
* `fetchTemplate(request, parseTemplate)` - Function that should fetch the template, call `parseTemplate` and return a promise of the result. Useful to implement your own way to retrieve and cache the templates, e.g. from s3.
Default implementation [`lib/fetch-template.js`](https://github.com/zalando/tailor/blob/master/lib/fetch-template.js) fetches the template from  the file system
* `templatesPath` - To specify the path where the templates are stored locally, Defaults to `/templates/`
* `fragmentTag` - Name of the fragment tag, defaults to `fragment`
* `handledTags` - An array of custom tags, check [`tests/handle-tag`](https://github.com/zalando/tailor/blob/master/tests/handle-tag.js) for more info
* `handleTag(request, tag)` - Receives a tag or closing tag and serializes it to a string or returns a stream
* `filterRequestHeaders(attributes, request)` - Function that filters the request headers that are passed to fragment request, check default implementation in [`lib/filter-headers`](https://github.com/zalando/tailor/blob/master/lib/filter-headers.js)
* `filterResponseHeaders(attributes, headers)` - Function that maps the given response headers from the primary fragment request to the final response
* `maxAssetLinks` - Number of `Link` Header directives for CSS and JS respected per fragment - defaults to `1`
* `requestFragment(filterHeaders)(url, attributes, request)` - Function that returns a promise of request to a fragment server, check the default implementation in [`lib/request-fragment`](https://github.com/zalando/tailor/blob/master/lib/request-fragment.js)
* `amdLoaderUrl` - URL to AMD loader. We use [RequireJS from cdnjs](https://cdnjs.com/libraries/require.js) as deafult
* `pipeInstanceName` - Pipe instance name that is available in the browser window for consuming frontend hooks.
* `pipeAttributes(attributes)` - Function that returns the minimal set of fragment attributes available on the frontend [hooks](https://github.com/zalando/tailor/blob/master/docs/hooks.md).

## Template

Tailor uses [parse5](https://github.com/inikulin/parse5/) to parse the template, where it replaces each `fragmentTag` with a stream from the fragment server and `handledTags` with the result of `handleTag` function.

```html
<html>
<head>
    <script type="fragment" src="http://assets.domain.com"></script>
</head>
<body>
    <fragment src="http://header.domain.com"></fragment>
    <fragment src="http://content.domain.com" primary></fragment>
    <fragment src="http://footer.domain.com" async></fragment>
</body>
</html>
```

### Fragment attributes

* `id` - optional unique identifier (autogenerated)
* `src` - URL of the fragment
* `primary` - denotes a fragment that sets the response code of the page
* `timeout` - optional timeout of fragment in milliseconds (default is 3000)
* `async` - postpones the fragment until the end of body tag
* `public` - by default, Tailor forwards the headers it gets from upstream to the fragments. To prevent this from happening, use the public attribute.
* `fallback-src` - URL of the fallback fragment in case of timeout/error on the current fragment

### Fragment server

A fragment is an http(s) server that renders only the part of the page and sets `Link` header to provide urls to CSS and JavaScript resources. Check `example/fragment.js` for the draft implementation.

A JavaScript of the fragment is an AMD module, that exports an `init` function, that will be called with DOM element of the fragment as an argument.

**Note: For compatability with AWS the `Link` header can also be passed as `x-amz-meta-link`**

### Concepts

Some of the concepts in Tailor are described in detail on the specific docs.

* [Events](https://github.com/zalando/tailor/blob/master/docs/Events.md)
* [Base Templates](https://github.com/zalando/tailor/blob/master/docs/Base-Templates.md)
* [Hooks](https://github.com/zalando/tailor/blob/master/docs/hooks.md)
* [Performance](https://github.com/zalando/tailor/blob/master/docs/Performance.md)

## Examples

```sh
# Get a copy of the repository
git clone https://github.com/zalando/tailor.git

# Change to the folder
cd tailor

# Install dependencies
npm install
```

* Basic - `node examples/basic`
* CSS and JS - `node examples/basic-css-and-js`
* Multiple Fragments and AMD - `node examples/multiple-fragments-with-custom-amd`
* Fragment Performance - `node examples/fragment-performance`

Go to [http://localhost:8080/index](http://localhost:8080/index) after running the specific example.

**Note: Please run the examples with node versions > 6.0.0**

## Benchmark

To start running benchmark execute `npm run benchmark` and wait for couple of seconds to see the results.

## Contributing

Please check the Contributing guidelines [here](https://github.com/zalando/tailor/blob/master/CONTRIBUTING.md).
