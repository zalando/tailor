'use strict';
const assert = require('assert');
const http = require('http');
const nock = require('nock');
const sinon = require('sinon');
const zlib = require('zlib');
const Tailor = require('../index');

describe('Tailor', () => {

    let server;
    const mockTemplate = sinon.stub();
    const mockChildTemplate = sinon.stub();
    const mockContext = sinon.stub();
    const cacheTemplate = sinon.spy();

    function getResponse (url) {
        return new Promise((resolve) => {
            http.get(url, (response) => {
                let chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end',() => {
                    response.body = Buffer.concat(chunks).toString('utf8');
                    resolve(response);
                });
            });
        });
    }

    beforeEach((done) => {
        const tailor = new Tailor({
            fetchContext: mockContext,
            pipeDefinition: () => new Buffer(''),
            fetchTemplate: (request, parseTemplate) => {
                const template = mockTemplate(request);
                const childTemplate = mockChildTemplate(request);
                if (template) {
                    return parseTemplate(template, childTemplate).then((parsedTemplate) => {
                        cacheTemplate(template);
                        return parsedTemplate;
                    });
                } else {
                    const error = new Error();
                    error.presentable = '<div>error template</div>';
                    return Promise.reject(error);
                }
            },
            pipeInstanceName: () => 'p'
        });
        mockContext.returns(Promise.resolve({}));
        server = http.createServer(tailor.requestHandler);
        server.listen(8080, 'localhost', done);
    });

    afterEach((done) => {
        mockContext.reset();
        mockTemplate.reset();
        mockChildTemplate.reset();
        cacheTemplate.reset();
        server.close(done);
    });

    it('should return 500 if the layout wasn\'t found', (done) => {
        mockTemplate.returns(false);
        getResponse('http://localhost:8080/missing-template').then((response) => {
            assert.equal(response.statusCode, 500);
            done();
        });
    });

    it('should render with presentable error template content', (done) => {
        mockTemplate.returns(false);
        getResponse('http://localhost:8080/missing-template').then((response) => {
            assert.equal(response.statusCode, 500);
            assert.equal(response.body, '<div>error template</div>');
            done();
        });
    });


    it('should stream content from http and https fragments', (done) => {

        nock('https://fragment')
            .get('/1').reply(200, 'hello');

        nock('http://fragment:9000')
            .get('/2').reply(200, 'world');

        mockTemplate
            .returns(
                '<fragment id="f-1" src="https://fragment/1"></fragment>' +
                '<fragment id="f-2" src="http://fragment:9000/2"></fragment>'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.statusCode, 200);
            assert.equal(
                response.body,
                '<html>' +
                '<head></head>' +
                '<body>' +
                '<script data-pipe>p.start(0)</script>hello<script data-pipe>p.end(0)</script>' +
                '<script data-pipe>p.start(1)</script>world<script data-pipe>p.end(1)</script>' +
                '</body>' +
                '</html>'
            );
            done();
        });

    });

    it('should return response code and location header ' +
       'of the 1st primary fragment', (done) => {
        nock('https://fragment')
            .get('/1').reply(200, 'hello')
            .get('/2').reply(300, 'world', {'Location': 'https://redirect'})
            .get('/3').reply(500, '!');

        mockTemplate
            .returns(
                '<fragment src="https://fragment/1"></fragment>' +
                '<fragment src="https://fragment/2" primary></fragment>' +
                '<fragment src="https://fragment/3" primary></fragment>'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.statusCode, 300);
            assert.equal(response.headers.location, 'https://redirect');
            done();
        });
    });

    it('should forward headers to fragment', (done) => {

        const headers = {
            'X-Zalando-Custom': 'test',
            'Referer': 'https://google.com',
            'Accept-Language': 'en-gb',
            'User-Agent': 'MSIE6',
            'X-Wrong-Header': 'should not be forwarded',
            'Cookie': 'value'
        };

        const expectedHeaders = {
            'X-Zalando-Custom': 'test',
            'Referer': 'https://google.com',
            'Accept-Language': 'en-gb',
            'User-Agent': 'MSIE6'
        };

        nock('https://fragment', {
            reqheaders: expectedHeaders,
            badheaders: ['X-Wrong-Header', 'Cookie']
        }).get('/').reply(200);

        mockTemplate
            .returns('<fragment src="https://fragment/"></fragment>');

        http.get({
            hostname: 'localhost',
            path: '/test',
            port: 8080,
            headers: headers
        }, (response) => {
            response.resume();
            done();
        });

    });

    it('should disable browser cache', (done) => {
        nock('https://fragment').get('/1').reply(200, 'hello');

        mockTemplate
            .returns('<fragment src="https://fragment/1"></fragment>');

        getResponse('http://localhost:8080/test').then((response) => {
            const headers = response.headers;
            assert.equal('no-cache, no-store, must-revalidate', headers['cache-control']);
            assert.equal('no-cache', headers['pragma']);
            done();
        });
    });

    it('should set timeout for a fragment request', (done) => {
        nock('https://fragment')
            .get('/1').socketDelay(101).reply(200, 'hello')
            .get('/2').socketDelay(3001).reply(200, 'world');

        mockTemplate
            .returns(
                '<fragment src="https://fragment/1" timeout="100"></fragment>' +
                '<fragment src="https://fragment/2"></fragment>'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body, '<html><head></head><body></body></html>');
            done();
        });
    });

    it('should return 500 in case of primary timeout', (done) => {
        nock('https://fragment')
            .get('/1').socketDelay(101).reply(200, 'hello');

        mockTemplate
            .returns(
                '<fragment src="https://fragment/1" primary timeout="100"></fragment>'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.statusCode, 500);
            done();
        });
    });

    it('should return 500 in case of primary error if fallback is not specified', (done) => {
        nock('https://fragment')
            .get('/1').replyWithError('panic!');

        mockTemplate
            .returns(
                '<fragment src="https://fragment/1" primary></fragment>'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.statusCode, 500);
            done();
        });
    });

    it('should fetch the fallback fragment when specified', (done) => {
        nock('https://fragment').
            get('/1').reply(500, 'Internal Server Error');
        nock('https://fragment').
            get('/fallback').reply(200, 'Fallback fragment');

        mockTemplate
            .returns(
                '<fragment src="https://fragment/1" fallback-src="https://fragment/fallback">' +
                '</fragment>'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.statusCode, 200);
            done();
        });
    });

    it('should return 500 if both primary and fallback fragment is not reachable', (done) => {
        nock('https://fragment').
            get('/1').replyWithError('panic!');
        nock('https://fragment').
            get('/fallback').reply(500, 'Internal Server Error');

        mockTemplate
            .returns(
                '<fragment src="https://fragment/1" primary fallback-src="https://fragment/fallback"> ' +
                '</fragment>'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.statusCode, 500);
            done();
        });
    });


    it('should insert link to css from fragment link header', (done) => {
        nock('https://fragment')
            .get('/1').reply(200, 'hello', {
                'Link': '<http://link>; rel="stylesheet",<http://link2>; rel="fragment-script"'
            });

        mockTemplate
            .returns('<fragment src="https://fragment/1"></fragment>');

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head></head>' +
                '<body>' +
                '<link rel="stylesheet" href="http://link">' +
                '<script data-pipe>p.start(0, "http://link2", false)</script>' +
                'hello' +
                '<script data-pipe>p.end(0, "http://link2", "0")</script>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

    it('should use loadCSS for async fragments', (done) => {
        nock('https://fragment')
            .get('/1').reply(200, 'hello', {
                'Link': '<http://link>; rel="stylesheet",<http://link2>; rel="fragment-script"'
            });

        mockTemplate
            .returns('<fragment async src="https://fragment/1"></fragment>');

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html><head></head><body>' +
                '<script data-pipe>p.placeholder(0)</script>' +
                '<script>p.loadCSS("http://link")</script>' +
                '<script data-pipe>p.start(0, "http://link2", false)</script>' +
                'hello' +
                '<script data-pipe>p.end(0, "http://link2", "0")</script>' +
                '</body></html>'
            );
            done();
        });
    });

    it('should insert link to css and require js  from fragment x-amz-meta-link header', (done) => {
        nock('https://fragment')
             .get('/1').reply(200, 'hello', {
                 'X-AMZ-META-LINK': '<http://link>; rel="stylesheet",<http://link2>; rel="fragment-script"'
             });

        mockTemplate
             .returns('<fragment src="https://fragment/1"></fragment>');

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head></head>' +
                '<body>' +
                '<link rel="stylesheet" href="http://link">' +
                '<script data-pipe>p.start(0, "http://link2", false)</script>' +
                'hello' +
                '<script data-pipe>p.end(0, "http://link2", "0")</script>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

    it('should support async fragments', (done) => {
        nock('https://fragment')
            .get('/1').reply(200, 'hello');

        mockTemplate
            .returns('<fragment src="https://fragment/1" async></fragment>');

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head></head>' +
                '<body>' +
                '<script data-pipe>p.placeholder(0)</script>' +
                '<script data-pipe>p.start(0)</script>' +
                'hello' +
                '<script data-pipe>p.end(0)</script>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

    it('should replace fragment attributes with the one from context', (done) => {
        nock('https://fragment')
            .get('/yes').reply(200, 'yes');

        mockTemplate
            .returns('<fragment async=false primary id="f-1" src="https://default/no"></fragment>');

        const contextObj = {
            'f-1' : {
                src : 'https://fragment/yes',
                primary: false,
                async: true
            }
        };
        mockContext.returns(Promise.resolve(contextObj));

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.statusCode, 200);
            assert.equal(response.body,
                '<html>' +
                '<head></head>' +
                '<body>' +
                '<script data-pipe>p.placeholder(0)</script>' +
                '<script data-pipe>p.start(0)</script>' +
                'yes' +
                '<script data-pipe>p.end(0)</script>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

    it('should not mutate the template with the context', (done) => {
        nock('https://fragment')
            .get('/yes').reply(200, 'yes')
            .get('/no').reply(200, 'no');

        mockTemplate
            .returns('<fragment async=false primary id="f-1" src="https://fragment/no"></frgament>');

        const contextObj = {
            'f-1' : {
                src : 'https://fragment/yes',
                primary: false,
                async: true
            }
        };
        mockContext.returns(Promise.resolve(contextObj));

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.statusCode, 200);
            assert.equal(response.body,
                '<html>' +
                '<head></head>' +
                '<body>' +
                '<script data-pipe>p.placeholder(0)</script>' +
                '<script data-pipe>p.start(0)</script>' +
                'yes' +
                '<script data-pipe>p.end(0)</script>' +
                '</body>' +
                '</html>'
            );

            // Second request
            mockContext.returns(Promise.resolve({}));
            mockTemplate.returns(cacheTemplate.args[0][0]);

            getResponse('http://localhost:8080/test').then((response) => {
                assert.equal(response.statusCode, 200);
                assert.equal(response.body,
                    '<html>' +
                    '<head></head>' +
                    '<body>' +
                    '<script data-pipe>p.placeholder(0)</script>' +
                    '<script data-pipe>p.start(0)</script>' +
                    'no' +
                    '<script data-pipe>p.end(0)</script>' +
                    '</body>' +
                    '</html>'
                );
                done();
            });
        });
    });

    it('should support script based fragments for inserting in head', (done) => {
        nock('https://fragment')
            .get('/yes').reply(200, 'yes');

        mockTemplate
            .returns('<script type="fragment" src="https://fragment/yes"></script>');

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head>' +
                '<script data-pipe>p.start(0)</script>' +
                'yes' +
                '<script data-pipe>p.end(0)</script>' +
                '</head>' +
                '<body></body>' +
                '</html>'
            );
            done();
        });
    });

    it('should support base templates using slots', (done) => {
        mockTemplate
            .returns(
                '<head>' +
                '<script type="slot" name="head"></script>' +
                '</head>'
            );

        mockChildTemplate
            .returns(
                '<meta slot="head" charset="utf-8">'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head>' +
                '<meta charset="utf-8">' +
                '</head>' +
                '<body></body>' +
                '</html>'
            );
            done();
        });
    });

    it('should support custom slots for shuffling the nodes', (done) => {
        mockTemplate
            .returns(
                '<head>' +
                '<script type="slot" name="head"></script>' +
                '</head>' +
                '<body>' +
                '<slot name="custom"></slot>' +
                '</body>'
            );

        mockChildTemplate
            .returns(
                '<script slot="custom" src=""></script>' +
                '<meta slot="head" charset="utf-8">' +
                '<h2>Last</h2>'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head>' +
                '<meta charset="utf-8">' +
                '</head>' +
                '<body>' +
                '<script src=""></script>' +
                '<h2>Last</h2>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

    it('should insert default slots if unnamed slot is present in parent template', (done) => {
        mockTemplate
            .returns(
                '<head>' +
                '</head>' +
                '<body>' +
                '<slot></slot>' +
                '<h2>blah</h2>' +
                '</body>'
            );

        mockChildTemplate.returns('<h1>hello</h1>');

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head></head>' +
                '<body>' +
                '<h1>hello</h1>' +
                '<h2>blah</h2>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

    it('should warn if there are duplicate unnamed slots', (done) => {
        sinon.stub(console, 'warn');
        mockTemplate.returns('<slot></slot><slot></slot>');

        http.get('http://localhost:8080/test', () => {
            assert.equal(console.warn.callCount, 1);
            console.warn.restore();
            done();
        });
    });

    it('should use the fallback slot nodes if present in the template', (done) => {
        mockTemplate
            .returns(
                '<slot name="custom">' +
                    '<h2>hello</h2>' +
                '</slot>'
            );

        mockChildTemplate.returns('');

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head>' +
                '</head>' +
                '<body>' +
                '<h2>hello</h2>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

    it('should override the fallback slot nodes with slotted nodes from child template', (done) => {
        mockTemplate
            .returns(
                '<slot name="custom">' +
                    '<h2>hello</h2>' +
                '</slot>'
            );

        mockChildTemplate.returns('<h2 slot="custom">child</h1>');

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head>' +
                '</head>' +
                '<body>' +
                '<h2>child</h2>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

    it('should include the child templates after the lastchild of body', (done) => {
        mockTemplate.returns('<body><h1></h1></body>');

        mockChildTemplate
            .returns(
                '<div>' +
                '<h2></h2>' +
                '</div>'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head></head>' +
                '<body>' +
                '<h1></h1>' +
                '<div><h2></h2></div>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

    it('should flatten nested fragments', (done) => {
        nock('https://fragment')
            .get('/1').reply(200, 'hello')
            .get('/2').reply(200, 'world');

        mockTemplate
            .returns(
                '<fragment src="https://fragment/1">' +
                    '<fragment src="https://fragment/2">' +
                    '</fragmemt>' +
                '</fragment>'
            );
        mockChildTemplate.returns('');

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head></head>' +
                '<body>' +
                '<script data-pipe>p.start(0)</script>' +
                'hello' +
                '<script data-pipe>p.end(0)</script>' +
                '<script data-pipe>p.start(1)</script>' +
                'world' +
                '<script data-pipe>p.end(1)</script>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

    it('should return 500 even if primary fragment is nested and timed out', (done) => {
        nock('https://fragment')
            .get('/1').reply(200, 'hello')
            .get('/2').socketDelay(101).reply(200, 'world');

        mockTemplate
            .returns(
                '<fragment src="https://fragment/1">' +
                    '<fragment primary timeout="100" src="https://fragment/2">' +
                    '</fragmemt>' +
                '</fragment>'
            );

        http.get('http://localhost:8080/test', (response) => {
            assert.equal(response.statusCode, 500);
            done();
        });
    });

    it('should unzip the fragment response if it is compressed', (done) => {
        nock('https://fragment')
            .get('/1').reply(200, 'hello')
            .defaultReplyHeaders({
                'content-encoding': 'gzip',
            })
            .get('/2')
            .reply(200, ()=> {
                return zlib.gzipSync('GZIPPED');
            });

        mockTemplate
            .returns(
                '<fragment src="https://fragment/1"></fragment>' +
                '<fragment src="https://fragment/2"></fragment>'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head></head>' +
                '<body>' +
                '<script data-pipe>p.start(0)</script>' +
                'hello' +
                '<script data-pipe>p.end(0)</script>' +
                '<script data-pipe>p.start(1)</script>' +
                'GZIPPED' +
                '<script data-pipe>p.end(1)</script>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

    it('should close the streams properly during unzping error', (done) => {
        nock('https://fragment')
            .defaultReplyHeaders({
                'content-encoding': 'gzip',
            })
            .get('/2')
            .reply(200, ()=> {
                return new Error('GZIP Error');
            });

        mockTemplate
            .returns(
                '<fragment src="https://fragment/2"></fragment>'
            );

        getResponse('http://localhost:8080/test').then((response) => {
            assert.equal(response.body,
                '<html>' +
                '<head></head>' +
                '<body>' +
                '<script data-pipe>p.start(0)</script>' +
                '<script data-pipe>p.end(0)</script>' +
                '</body>' +
                '</html>'
            );
            done();
        });
    });

});
