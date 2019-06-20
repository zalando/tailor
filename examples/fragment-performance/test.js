const puppeteer = require('puppeteer');
const assert = require('assert');
const http = require('http');

const Tailor = require('../../index');
const serveFragment = require('../multiple-fragments-with-custom-amd/fragment');
const { analyseHooks } = require('./hooks');

describe("Fragment performance in browser", () => {
    let server;

    before(() => {
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
        server.listen(8080);
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

    after(() => {
        if(server != null) {
            server.close();
        }
    })

    it("should be able to capture performance metrics in browser", async () => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        try {
            // Forcing to wait till there are no networking events
            await page.goto('http://localhost:8080/index', {
                waitUntil: 'networkidle0'
            });
            // Capture all the fragment related metrics
            const metrics = await page.evaluate(() => {
                // Serializing the outputs otherwise it will be undefined
                return [
                    JSON.stringify(performance.getEntriesByType('mark')),
                    JSON.stringify(performance.getEntriesByType('measure')),
                    JSON.stringify(window.TailorPipe.getEntries())
                ];
            });
            const [mark, measure, entries] = [
                JSON.parse(metrics[0]),
                JSON.parse(metrics[1]),
                JSON.parse(metrics[2])
            ];
            await analyseHooks(mark, measure, entries);
            await browser.close();
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    }).timeout(5000); // Add increased timeout since the test runs inside puppeteer
});
