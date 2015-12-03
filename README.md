# Tailor

```javascript
const http = require('http');
const Tailor = require('opensource-tailor');
const tailor = new Tailor();
const server = http.createServer(tailor.requestHandler);
server.listen(process.env.PORT || 8080);
```
