<h1><img width="400" alt="Tailor" src="https://rawgithub.com/zalando/tailor/master/tailor.svg"></h1>

[![Build Status](https://travis-ci.org/zalando/tailor.svg?branch=master)](https://travis-ci.org/zalando/tailor)
[![Test Coverage](https://codeclimate.com/github/zalando/tailor/badges/coverage.svg)](https://codeclimate.com/github/zalando/tailor/coverage)

Tailor is a layout service that uses streams to compose a web page from fragment services.

```javascript
const http = require('http');
const Tailor = require('tailor');
const tailor = new Tailor({/* Options */});
const server = http.createServer(tailor.requestHandler);
server.listen(process.env.PORT || 8080);
```

# Options

* `filterHeaders(fragment.attributes, headers)` a function that receives fragment attributes and request headers and should return headers for the fragment
* `fetchContext(request)` a function that returns a promise of the context, that is an object that maps fragment id to fragment url
* `fetchTemplate(request, parseTemplate)` a function that should fetch the template, call `parseTemplate` and return a promise of the result.
* `fragmentTag` a name of the fragment tag
* `handledTags` an array of custom tags
* `handleTag` receives a tag or closing tag and serializes it to a string
* `forceSmartPipe(request)` returns a boolean that forces all async fragments in sync mode.
* `requestFragment(options)` a function that returns a promise of request to a fragment server

# Events

`Tailor` extends `EventEmitter`, so you can subscribe to events with `tailor.on('eventName', callback)`.  
Events should be used for logging and monitoring.

## Top level events

* Client request received: `start(request)`
* Response started (headers flushed and stream connected to output): `response(request, status, headers)`
* Response ended (with the total size of response): `end(request, contentSize)`
* Template Error: `template:error(request, error)` in case an error fetching or parsing the template
* Context Error: `context:error(request, error)` in case of an error fetching the context
* Primary error: `primary:error(request, fragment.attributes, error)` in case of socket error, timeout, 50x of the primary fragment

## Fragment events

* Request start: `fragment:start(request, fragment.attributes)`
* Response Start when headers received: `fragment:response(request, fragment.attributes, status, headers)`
* Response End (with response size): `fragment:end(request, fragment.attributes, contentSize)`
* Error: `fragment:error(request, fragment.attributes, error)` in case of socket error, timeout, 50x

# Example

To start an example execute `npm run example` and open [http://localhost:8080/index](http://localhost:8080/index).
