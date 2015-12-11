# Tailor

Tailor is a layout service that uses streams to compose a web page from fragment services.

```javascript
const http = require('http');
const Tailor = require('tailor');
const tailor = new Tailor({/* Options */});
const server = http.createServer(tailor.requestHandler);
server.listen(process.env.PORT || 8080);
```

# Options

* `filterHeaders(headers)` a function that receives request headers and should return headers for the fragment
* `fetchContext(request)` a function that returns a promise of the context, that is an object that maps fragment id to fragment url
* `fetchTemplate(request, parseTemplate)` a function that should fetch the template, call `parseTemplate` and return a promise of the result.
* `fragmentTag` a name of the fragment tag
* `handledTags` an array of custom tags
* `handleTag` receives a tag or closing tag and serializes it to a string
* `forceSmartPipe(request)` returns a boolean that forces all async fragments in sync mode.
* `cdnUrl(url)` a function that is called for each static asset with an original url, and should return a modified url

# Events

`Tailor` extends `EventEmitter`, so you can subscribe to events with `tailor.on('eventName', callback)`.  
Events should be used for logging and monitoring.

## Top level events

* Client request received: `start(request)`
* Response started (headers flushed and stream connected to output): `response(request, status, headers)`
* Response ended (with the total size of response): `end(request, contentSize)`
* Template Error: `template:error(request, error)` in case an error fetching or parsing the template
* Context Error: `context:error(request, error)` in case of an error fetching the context
* Primary error: `primary:error(request, fragment, error)` in case of socket error, timeout, 50x of the primary fragment

## Fragment events:

* Request start: `fragment:start(request, fragment)`
* Response Start when headers received: `fragment:response(request, fragment, status, headers)`
* Response End (with response size): `fragment:end(request, fragment, contentSize)`
* Error: `fragment:error(request, fragment, error)` in case of socket error, timeout, 50x






