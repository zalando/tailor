const http = require('http');

const Tailor = require('../../index');
const serveFragment = require('../multiple-fragments-with-custom-amd/fragment');
const { validateHooks } = require('./hooks');

describe("Fragment performance in browser", () => {
    let server;

    before((done) => {
        const tailor = new Tailor({
            templatesPath: __dirname + '/templates',
            pipeAttributes: attributes => {
                const timingGroups = attributes['timing-group']
                    ? attributes['timing-group'].split(',')
                    : [];
                const { id, primary } = attributes;
                return { timingGroups, id, primary: !!(primary || primary === '') };
            },
            pipeInstanceName: 'TailorPipe',
            maxAssetLinks: 3
        });
        server = http.createServer((req, res) => {
            if (req.url === '/favicon.ico') {
                res.writeHead(200, { 'Content-Type': 'image/x-icon' });
                return res.end('');
            }
            return tailor.requestHandler(req, res);
        });
        server.listen(8080, done);
        tailor.on('error', (request, err) => console.error(err));
    
        const fragment1 = http.createServer(
            serveFragment('Header', 'http://localhost:8081', 1)
        );
        fragment1.listen(8081);
    
        const fragment2 = http.createServer(
            serveFragment('Primary', 'http://localhost:8082', 2)
        );
        fragment2.listen(8082);
    
        const fragment3 = http.createServer(
            serveFragment('Footer', 'http://localhost:8083', 3, true)
        );
        fragment3.listen(8083);
    })

    after((done) => {
        if(server != null) {
            server.close(done);
        }
    })

    it("should be able to capture performance metrics in browser", async () => {
        await validateHooks();
    }).timeout(8000); // Add increased timeout since the test runs inside puppeteer
});
