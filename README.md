# Tailor

```javascript
const http = require('http');
const Tailor = require('tailor');
const tailor = new Tailor();
const server = http.createServer(tailor.requestHandler);
server.listen(process.env.PORT || 8080);
```

To see the list of available options please check `index.js`.
