# Tailor

```javascript
const http = require('http');
const Tailor = require('tailor');
const tailor = new Tailor();
const server = http.createServer(tailor.requestHandler);
server.listen(process.env.PORT || 8080);
```

# Options

`filterHeaders(headers)` a function that receives request headers and should return headers for the fragment
`fetchContext(request)` a function that returns a promise of the context, that is an object that maps fragment id to fragment url
`fetchTemplate(request, parseTemplate)` a function that should fetch the template, call `parseTemplate` and return a promise of the result.
`fragmentTag` a name of the fragment tag
`handledTags` an array of custom tags
`handleTag` receives a tag or closing tag and serializes it to a string
`forceSmartPipe(request)` returns a boolean that forces all async fragments in sync mode.
`cdnUrl(url)` function that is called for each static asset with original url, and should return modified url
