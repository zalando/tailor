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
