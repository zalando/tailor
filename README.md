<h1><img width="400" alt="Tailor" src="https://rawgithub.com/zalando/tailor/master/tailor.svg"></h1>

[![NPM](https://nodei.co/npm/node-tailor.png)](https://npmjs.org/package/add-eventlistener-with-options)

[![Build Status](https://travis-ci.org/zalando/tailor.svg?branch=master)](https://travis-ci.org/zalando/tailor)
[![Test Coverage](https://codecov.io/github/zalando/tailor/coverage.svg?precision=0)](https://codecov.io/github/addi90/build-notification-api/coverage)

## npm status
[![downloads](https://img.shields.io/npm/dt/node-tailor.svg)]()
[![version](https://img.shields.io/npm/v/node-tailor.svg)]()


Tailor is a layout service that uses streams to compose a web page from fragment services. O'Reilly describes it in the title of [this blog post](https://www.oreilly.com/ideas/better-streaming-layouts-for-frontend-microservices-with-tailor) as "a library that provides a middleware which you can integrate into any Node.js server." It's partially inspired by Facebook’s [BigPipe](https://www.facebook.com/notes/facebook-engineering/bigpipe-pipelining-web-pages-for-high-performance/389414033919/), but developed in an ecommerce context.

Some of Tailor's features and benefits:

- **Composes pre-rendered markup on the backend**. This is important for SEO and fastens the initial render.
- **Ensures a fast Time to First Byte**. Tailor requests fragments in parallel and streams them as soon as possible, without blocking the rest of the page.
- **Enforces performance budget**. This is quite challenging otherwise, because there is no single point where you can control performance.
- **Fault Tolerance**. Render the meaningful output, even if a page fragment has failed or timed out.

Tailor is part of [Project Mosaic](https://www.mosaic9.org/), which aims to help developers create microservices for the frontend. The Mosaic also includes an extendable HTTP router for service composition ([Skipper](https://github.com/zalando/skipper)) with related RESTful API that stores routes ([Innkeeper](https://github.com/zalando/innkeeper)); more components are in the pipeline for public release. If your front-end team is making the monolith-to-microservices transition, you might find Tailor and its available siblings beneficial.

## Why a Layout Service?

Microservices get a lot of traction these days. They allow multiple teams to work independently from each other, choose their own technology stacks and establish their own release cycles. Unfortunately, frontend development hasn’t fully capitalized yet on the benefits that microservices offer. The common practice for building websites remains “the monolith”: a single frontend codebase that consumes multiple APIs.

What if we could have microservices on the frontend? This would allow frontend developers to work together with their backend counterparts on the same feature and independently deploy parts of the website — “fragments” such as Header, Product, and Footer. Bringing microservices to the frontend requires a layout service that composes a website out of fragments. Tailor was developed to solve this need.

## Installation

Begin using Tailor with:

`npm i node-tailor --save`

```javascript
const http = require('http');
const Tailor = require('node-tailor');
const tailor = new Tailor({/* Options */});
const server = http.createServer(tailor.requestHandler);
server.listen(process.env.PORT || 8080);
```

## Options

* `fetchContext(request)` a function that returns a promise of the context, that is an object that maps fragment id to fragment url, to be able to override urls of the fragments on the page, defaults to `Promise.resolve({})`
* `fetchTemplate(request, parseTemplate)` a function that should fetch the template, call `parseTemplate` and return a promise of the result. Useful to implement your own way to retrieve and cache the templates, e.g. from s3.
Default implementation [`lib/fetch-template.js`](https://github.com/zalando/tailor/blob/master/lib/fetch-template.js) fetches the template from  the file system
* `fragmentTag` a name of the fragment tag, defaults to `fragment`
* `handledTags` an array of custom tags, check [`tests/handle-tag`](https://github.com/zalando/tailor/blob/master/tests/handle-tag.js) for more info
* `handleTag(request, tag)` receives a tag or closing tag and serializes it to a string or returns a stream
* `requestFragment(url, fragmentAttributes, request)` a function that returns a promise of request to a fragment server, check the default implementation in [`lib/request-fragment`](https://github.com/zalando/tailor/blob/master/lib/request-fragment.js)
* `amdLoaderUrl` - URL to AMD loader. We use [RequireJS from cdnjs](https://cdnjs.com/libraries/require.js) as deafult

# Template

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

## Fragment attributes

* *id* — optional unique identifier (autogenerated)
* *src* — URL of the fragment
* *primary* — denotes a fragment that sets the response code of the page
* *timeout* - optional timeout of fragment in milliseconds (default is 3000)
* *async* — postpones the fragment until the end of body tag
* *public* — by default, Tailor forwards the headers it gets from upstream to the fragments. To prevent this from happening, use the public attribute.
* *fallback-src* - URL of the fallback fragment in case of timeout/error on the current fragment

## Fragment server

A fragment is an http(s) server that renders only the part of the page and sets `Link` header to provide urls to CSS and JavaScript resources. Check `example/fragment.js` for the draft implementation.

A JavaScript of the fragment is an AMD module, that exports an `init` function, that will be called with DOM element of the fragment as an argument.

# Events

`Tailor` extends `EventEmitter`, so you can subscribe to events with `tailor.on('eventName', callback)`.

Events may be used for logging and monitoring. Check `perf/benchmark.js` for an example of getting metrics from Tailor.

## Top level events

* Client request received: `start(request)`
* Response started (headers flushed and stream connected to output): `response(request, status, headers)`
* Response ended (with the total size of response): `end(request, contentSize)`
* Error: `error(request, error)` in case an error from template (parsing,fetching) and primary error(socket/timeout/50x)
* Context Error: `context:error(request, error)` in case of an error fetching the context

## Fragment events

* Request start: `fragment:start(request, fragment.attributes)`
* Response Start when headers received: `fragment:response(request, fragment.attributes, status, headers)`
* Response End (with response size): `fragment:end(request, fragment.attributes, contentSize)`
* Error: `fragment:error(request, fragment.attributes, error)` in case of socket error, timeout, 50x
* Fallback: `fragment:fallback(request, fragment.attributes, error)` in case of timeout/error from the fragment if the *fallback-src* is specified


**Note:**  `fragment:response`, `fragment:fallback` and `fragment:error` are mutually exclusive. `fragment:end` happens only in case of successful response.

# Base Templates

Seeing how multiple templates are sharing quite a few commonalities, the need to be able to define a base template arose.
The implemented solution introduces the concept of slots that you define within these templates. Derived templates will use slots as placeholders for their elements.

* A derived template will only contain fragments and tags. These elements will be used to populate the base template.
* You can assign any number of elements to a slot.
* If a tag is not valid at the position of the slot then it will be appended to the body of the base template. For example, a div tag is not valid in the head.
* If you need to place your fragment in a slot inside the head, you will need to define it
like this `<script type="fragment" slot="custom-slot-name" primary ...></script>`.
* All fragments and tags that are not assigned to a slot will be appended to the body of the base template.

*base-template.html*
```html
<!doctype html>
<html>
<head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="dns-prefetch" href="https://example.com" />
    <script type="slot" name="head"></script>
</head>
<body>
    <slot name="body-start"></slot>
    <div>Hello</div>
</body>
</html>
```

*example-page.html*

```html
<meta slot="head" charset="utf-8">
<script slot="body-start" src="http://blah"></script>
<fragment src="http://localhost" async primary ></fragment>
<title slot="head">Test Template</title>
```

The rendered html output will look like this
```html
<!doctype html>
<html>
<head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="dns-prefetch" href="https://example.com" />
    <meta charset="utf-8">
    <title>Test Template</title>
</head>
<body>
    <script src="http://blah"></script>
    <div>Hello</div>
    <fragment src="http://localhost" async primary ></fragment>
</body>
</html>
```

# Examples

## Basic

`node examples/basic` and open [http://localhost:8080/index](http://localhost:8080/index).

## CSS and JS

`node examples/basic-css-and-js` and open [http://localhost:8080/index](http://localhost:8080/index).

## Multiple Fragments and AMD

`node examples/multiple-fragments-with-custom-amd` and open [http://localhost:8080/index](http://localhost:8080/index).

**Note: Please run the examples with `--harmony` flag for node 4.x versions**

# Benchmark

To start running benchmark execute `npm run benchmark` and wait for couple of seconds to see the results.
