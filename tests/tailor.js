'use strict';
const assert = require('assert');
const http = require('http');
const nock = require('nock');
const sinon = require('sinon');
const zlib = require('zlib');
const Tailor = require('../index');

describe('Tailor', () => {

    let server;
    let serverCustomOptions;
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

    const createTailorInstance = ({ maxAssetLinks = 1 } = {}) => new Tailor({
        fetchContext: mockContext,
        maxAssetLinks,
        pipeDefinition: () => Buffer.from(''),
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
        pipeInstanceName: 'p',
        pipeAttributes: (attributes) => ({ id: attributes.id }),
        filterResponseHeaders: (attributes, headers) => headers,
    });

    beforeEach((done) => {
        const tailor = createTailorInstance();
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

    describe('Basic Features::Tailor', () => {
        it('should return 500 with presentable error if the layout wasn\'t found', (done) => {
            mockTemplate.returns(false);
            getResponse('http://localhost:8080/missing-template').then((response) => {
                assert.equal(response.statusCode, 500);
                assert.equal(response.body, '<div>error template</div>');
            }).then(done, done);
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
            }).then(done, done);

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
            }).then(done, done);
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
                        '<body></body>'+
                    '</html>'
                );
            }).then(done, done);
        });
    });

    describe('Headers::Tailor ', () => {
        it('should return response code and location header of the 1st primary fragment', (done) => {
            nock('https://fragment')
                .get('/1').reply(200, 'hello')
                .get('/2').reply(300, 'world', { 'Location': 'https://redirect' })
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
            }).then(done, done);
        });

        it('should return headers from primary fragment', (done) => {
            const cookie = 'zalando.guid=6cc4da81; path=/; httponly';

            nock('https://fragment')
                .get('/1').reply(200, 'hello', { 'Set-Cookie': 'wrong' })
                .get('/2').reply(200, 'world', { 'Set-Cookie': cookie })
                .get('/3').reply(201);

            mockTemplate
                .returns(
                    '<fragment src="https://fragment/1"></fragment>' +
                    '<fragment src="https://fragment/2" primary></fragment>' +
                    '<fragment src="https://fragment/3"></fragment>'
                );

            getResponse('http://localhost:8080/test').then((response) => {
                assert.equal(response.statusCode, 200);
                assert.deepEqual(response.headers['set-cookie'], [cookie]);
            }).then(done, done);
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
            }).then(done, done);
        });

        it('should send Link headers for preloading if primary fragment exists', (done) => {
            nock('https://fragment')
                .get('/1').reply(200, 'non-primary', {
                    'Link': '<http://non-primary>; rel="stylesheet",<http://non-primary>; rel="fragment-script"'
                })
                .get('/2').reply(200, 'primary', {
                    'Link': '<http://primary>; rel="stylesheet",<http://primary>; rel="fragment-script"'
                });

            mockTemplate
                .returns(
                    '<fragment src="https://fragment/1"></fragment>' +
                    '<fragment primary src="https://fragment/2"></fragment>'
                );

            getResponse('http://localhost:8080/test').then((response) => {
                assert.equal(response.headers.link, '<http://primary>; rel="preload"; as="style"; nopush,<http://primary>; rel="preload"; as="script"; nopush; crossorigin');
            }).then(done, done);
        });

        it('should not send crossorigin in Link headers for same origin scripts', (done) => {
            nock('http://fragment')
                .get('/').reply(200, 'primary', {
                    'Link': '<http://localhost:8080>; rel="stylesheet",<http://localhost:8080>; rel="fragment-script"'
                });

            mockTemplate.returns('<fragment primary src="http://fragment/"></fragment>');

            getResponse('http://localhost:8080/test').then((response) => {
                assert.equal(response.headers.link, '<http://localhost:8080>; rel="preload"; as="style"; nopush,<http://localhost:8080>; rel="preload"; as="script"; nopush; ');
            }).then(done, done);
        });

        it('shouldn\'t send preloading headers if primary fragment doesn\'t exist', (done) => {
            nock('https://fragment')
                .get('/1').reply(200, 'hello', {
                    'Link': '<http://link>; rel="stylesheet",<http://link>; rel="fragment-script"'
                });

            mockTemplate.returns('<fragment src="https://fragment/1"></fragment>');

            getResponse('http://localhost:8080/test').then((response) => {
                assert.equal(response.headers.link, undefined);
            }).then(done, done);
        });
    });

    describe('Timeout::Tailor ', () => {
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
            }).then(done, done);
        });

        it('should return 500 in case of primary timeout', (done) => {
            nock('https://fragment')
                .get('/1').socketDelay(101).reply(200, 'hello');

            mockTemplate
                .returns('<fragment src="https://fragment/1" primary timeout="100"></fragment>');

            getResponse('http://localhost:8080/test').then((response) => {
                assert.equal(response.statusCode, 500);
            }).then(done, done);
        });
    });

    describe('Fallback::Tailor ', () => {
        it('should return 500 in case of primary error if fallback is not specified', (done) => {
            nock('https://fragment')
                .get('/1').replyWithError('panic!');

            mockTemplate
                .returns('<fragment src="https://fragment/1" primary></fragment>');

            getResponse('http://localhost:8080/test').then((response) => {
                assert.equal(response.statusCode, 500);
            }).then(done, done);
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
            }).then(done, done);
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
            }).then(done, done);
        });

    });

    describe('Link::Tailor: ', () => {
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
                    '<script data-pipe>p.start(0, "http://link2", {"id":0,"range":[0,0]})</script>' +
                    'hello' +
                    '<script data-pipe>p.end(0, "http://link2", {"id":0,"range":[0,0]})</script>' +
                    '</body>' +
                    '</html>'
                );
            }).then(done, done);
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
                    '<script data-pipe>p.start(0, "http://link2", {"id":0,"range":[0,0]})</script>' +
                    'hello' +
                    '<script data-pipe>p.end(0, "http://link2", {"id":0,"range":[0,0]})</script>' +
                    '</body></html>'
                );
            }).then(done, done);
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
                    '<script data-pipe>p.start(0, "http://link2", {"id":0,"range":[0,0]})</script>' +
                    'hello' +
                    '<script data-pipe>p.end(0, "http://link2", {"id":0,"range":[0,0]})</script>' +
                    '</body>' +
                    '</html>'
                );
            }).then(done, done);
        });
    });

    describe('Attributes and Context::Tailor', () => {
        it('should call the pipe start and end with custom pipe attributes', (done) => {
            nock('https://fragment')
                .get('/1').reply(200, 'hello', {
                    'Link': '<http://link2>; rel="fragment-script"'
                });

            mockTemplate
                .returns('<fragment id="foo" src="https://fragment/1"></fragment>');

            getResponse('http://localhost:8080/test').then((response) => {
                assert.equal(response.body,
                    '<html><head></head><body>' +
                    '<script data-pipe>p.start(0, "http://link2", {"id":"foo","range":[0,0]})</script>' +
                    'hello' +
                    '<script data-pipe>p.end(0, "http://link2", {"id":"foo","range":[0,0]})</script>' +
                    '</body></html>'
                );
            }).then(done, done);
        });

        it('should get attributes from context and not mutate the template with the context', (done) => {
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
                }).then(done, done);
            });
        });
    });

    describe('Slots::Tailor ', () => {
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
            }).then(done, done);
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
            }).then(done, done);
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
            }).then(done, done);
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
            }).then(done, done);
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
            }).then(done, done);
        });

    });

    describe('Nested Fragments::Tailor ', () => {
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
            }).then(done, done);
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
            }).then(done, done);
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
    });

    describe('Zip::Tailor ', () => {
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
            }).then(done, done);
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
            }).then(done, done);
        });
    });

    describe('without option `maxAssetLinks` provided', () => {
        it('should handle the first fragment-script Header Link only', (done) => {
            nock('https://fragment')
                .get('/1').reply(200, 'hello maxAssetLinks default', {
                    'Link': '<http://link1>; rel="fragment-script", <http://link2>; rel="fragment-script", <http://link3>; rel="fragment-script"'
                });

            mockTemplate
                .returns('<fragment src="https://fragment/1"></fragment>');

            getResponse('http://localhost:8080/test').then((response) => {
                assert.equal(response.body,
                    '<html><head></head><body>' +
                    '<script data-pipe>p.start(0, "http://link1", {"id":0,"range":[0,0]})</script>' +
                    'hello maxAssetLinks default' +
                    '<script data-pipe>p.end(0, "http://link1", {"id":0,"range":[0,0]})</script>' +
                    '</body></html>'
                );
            }).then(done, done);
        });

        it('should handle the first stylesheet Header Link only', (done) => {
            nock('https://fragment')
                .get('/1').reply(200, 'hello multiple styles with default config', {
                    'Link': '<http://css1>; rel="stylesheet",<http://css2>; rel="stylesheet",<http://css3>; rel="stylesheet"'
                });
            mockTemplate
                .returns('<fragment src="https://fragment/1"></fragment>');

            getResponse('http://localhost:8080/test').then((response) => {
                assert.equal(response.body,
                    '<html>' +
                    '<head></head>' +
                    '<body>' +
                    '<link rel="stylesheet" href="http://css1">' +
                    '<script data-pipe>p.start(0)</script>' +
                    'hello multiple styles with default config' +
                    '<script data-pipe>p.end(0)</script>' +
                    '</body>' +
                    '</html>'
                );
            }).then(done, done);
        });
    });

    describe('with `maxAssetLinks` set to `3`', () => {
        beforeEach((done) => {
            const tailor2 = createTailorInstance({ maxAssetLinks: 3 });
            mockContext.returns(Promise.resolve({}));
            serverCustomOptions = http.createServer(tailor2.requestHandler);
            serverCustomOptions.listen(8081, 'localhost', done);
        });

        afterEach((done) => {
            mockContext.reset();
            mockTemplate.reset();
            mockChildTemplate.reset();
            cacheTemplate.reset();
            serverCustomOptions.close(done);
        });

        it('should handle only the first 3 fragment-script Link-rels', (done) => {
            nock('https://fragment')
                .get('/1').reply(200, 'hello multiple', {
                    'Link': '<http://link1>; rel="fragment-script", <http://link2>; rel="fragment-script", <http://link3>; rel="fragment-script",' +
                    '<http://link4>; rel="fragment-script", <http://link5>; rel="fragment-script", <http://link6>; rel="fragment-script"'
                });

            mockTemplate
                .returns('<fragment src="https://fragment/1"></fragment>');

            getResponse('http://localhost:8081/test').then((response) => {
                assert.equal(response.body,
                    '<html><head></head><body>' +
                    '<script data-pipe>p.start(0, "http://link1", {"id":0,"range":[0,2]})</script>' +
                    '<script data-pipe>p.start(1, "http://link2", {"id":0,"range":[0,2]})</script>' +
                    '<script data-pipe>p.start(2, "http://link3", {"id":0,"range":[0,2]})</script>' +
                    'hello multiple' +
                    '<script data-pipe>p.end(2, "http://link3", {"id":0,"range":[0,2]})</script>' +
                    '<script data-pipe>p.end(1, "http://link2", {"id":0,"range":[0,2]})</script>' +
                    '<script data-pipe>p.end(0, "http://link1", {"id":0,"range":[0,2]})</script>' +
                    '</body></html>'
                );
            }).then(done, done);
        });

        it('should assign correct IDs to sync and async fragments', (done) => {
            nock('https://fragment')
                .get('/1').reply(200, 'hello many', {
                    'Link': '<http://link-a1>; rel="fragment-script", <http://link-a2>; rel="fragment-script", <http://link-a3>; rel="fragment-script",' +
                    '<http://link-a4>; rel="fragment-script"'
                })
                .get('/2').reply(200, 'hello single', {
                    'Link': '<http://link-b1>; rel="fragment-script"'
                })
                .get('/3').reply(200, 'hello exactly three async', {
                    'Link': '<http://link-c1>; rel="fragment-script", <http://link-c2>; rel="fragment-script", <http://link-c3>; rel="fragment-script",'
                })
                .get('/4').reply(200, 'hello exactly three', {
                    'Link': '<http://link-d1>; rel="fragment-script", <http://link-d2>; rel="fragment-script", <http://link-d3>; rel="fragment-script",'
                });

            mockTemplate
                .returns(
                    '<fragment src="https://fragment/1"></fragment>' +
                    '<fragment id="f-2" async src="https://fragment/2"></fragment>' +
                    '<fragment async src="https://fragment/3"></fragment>' +
                    '<fragment src="https://fragment/4"></fragment>'
                );

            getResponse('http://localhost:8081/test').then((response) => {
                assert.equal(response.body,
                    '<html><head></head><body>' +
                    '<script data-pipe>p.start(0, "http://link-a1", {"id":0,"range":[0,2]})</script>' +
                    '<script data-pipe>p.start(1, "http://link-a2", {"id":0,"range":[0,2]})</script>' +
                    '<script data-pipe>p.start(2, "http://link-a3", {"id":0,"range":[0,2]})</script>' +
                    'hello many' +
                    '<script data-pipe>p.end(2, "http://link-a3", {"id":0,"range":[0,2]})</script>' +
                    '<script data-pipe>p.end(1, "http://link-a2", {"id":0,"range":[0,2]})</script>' +
                    '<script data-pipe>p.end(0, "http://link-a1", {"id":0,"range":[0,2]})</script>' +

                    '<script data-pipe>p.placeholder(3)</script>' +

                    '<script data-pipe>p.placeholder(6)</script>' +

                    '<script data-pipe>p.start(9, "http://link-d1", {"id":9,"range":[9,11]})</script>' +
                    '<script data-pipe>p.start(10, "http://link-d2", {"id":9,"range":[9,11]})</script>' +
                    '<script data-pipe>p.start(11, "http://link-d3", {"id":9,"range":[9,11]})</script>' +
                    'hello exactly three' +
                    '<script data-pipe>p.end(11, "http://link-d3", {"id":9,"range":[9,11]})</script>' +
                    '<script data-pipe>p.end(10, "http://link-d2", {"id":9,"range":[9,11]})</script>' +
                    '<script data-pipe>p.end(9, "http://link-d1", {"id":9,"range":[9,11]})</script>' +

                    '<script data-pipe>p.start(3, "http://link-b1", {"id":"f-2","range":[3,3]})</script>' +
                    'hello single' +
                    '<script data-pipe>p.end(3, "http://link-b1", {"id":"f-2","range":[3,3]})</script>' +

                    '<script data-pipe>p.start(6, "http://link-c1", {"id":6,"range":[6,8]})</script>' +
                    '<script data-pipe>p.start(7, "http://link-c2", {"id":6,"range":[6,8]})</script>' +
                    '<script data-pipe>p.start(8, "http://link-c3", {"id":6,"range":[6,8]})</script>' +
                    'hello exactly three async' +
                    '<script data-pipe>p.end(8, "http://link-c3", {"id":6,"range":[6,8]})</script>' +
                    '<script data-pipe>p.end(7, "http://link-c2", {"id":6,"range":[6,8]})</script>' +
                    '<script data-pipe>p.end(6, "http://link-c1", {"id":6,"range":[6,8]})</script>' +

                    '</body></html>'
                );
            }).then(done, done);
        });

        it('should insert all 3 links to css from fragment link header', (done) => {
            nock('https://fragment')
                .get('/1').reply(200, 'hello multiple styles ', {
                    'Link': '<http://script-link>; rel="fragment-script",<http://css1>; rel="stylesheet",<http://css2>; rel="stylesheet",<http://css3>; rel="stylesheet"'
                });
            mockTemplate
                .returns('<fragment src="https://fragment/1"></fragment>');

            getResponse('http://localhost:8081/test').then((response) => {
                assert.equal(response.body,
                    '<html>' +
                    '<head></head>' +
                    '<body>' +
                    '<link rel="stylesheet" href="http://css1">' +
                    '<link rel="stylesheet" href="http://css2">' +
                    '<link rel="stylesheet" href="http://css3">' +
                    '<script data-pipe>p.start(0, "http://script-link", {"id":0,"range":[0,0]})</script>' +
                    'hello multiple styles ' +
                    '<script data-pipe>p.end(0, "http://script-link", {"id":0,"range":[0,0]})</script>' +
                    '</body>' +
                    '</html>'
                );
            }).then(done, done);
        });

        it('should use loadCSS for async fragments for all 3 styles', (done) => {
            nock('https://fragment')
                .get('/1').reply(200, 'hello multiple styles async', {
                    'Link': '<http://link1>; rel="stylesheet",<http://link2>; rel="stylesheet",<http://link3>; rel="stylesheet",<http://link4>; rel="fragment-script"'
                });

            mockTemplate
                .returns('<fragment async src="https://fragment/1"></fragment>');

            getResponse('http://localhost:8081/test').then((response) => {
                assert.equal(response.body,
                    '<html><head></head><body>' +
                    '<script data-pipe>p.placeholder(0)</script>' +
                    '<script>p.loadCSS("http://link1")</script>' +
                    '<script>p.loadCSS("http://link2")</script>' +
                    '<script>p.loadCSS("http://link3")</script>' +
                    '<script data-pipe>p.start(0, "http://link4", {"id":0,"range":[0,0]})</script>' +
                    'hello multiple styles async' +
                    '<script data-pipe>p.end(0, "http://link4", {"id":0,"range":[0,0]})</script>' +
                    '</body></html>'
                );
            }).then(done, done);
        });
    });
});
