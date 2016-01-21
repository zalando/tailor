'use strict';
const assert = require('assert');
const http = require('http');
const nock = require('nock');
const sinon = require('sinon');
const Tailor = require('../index');
const PassThrough = require('stream').PassThrough;

describe('Tailor', () => {

    let server;
    const mockTemplate = sinon.stub();
    const mockContext = sinon.stub();

    beforeEach((done) => {
        const tailor = new Tailor({
            fetchContext: mockContext,
            fetchTemplate: (request, parseTemplate) => {
                const template = mockTemplate(request);
                if (template) {
                    if (typeof template === 'string') {
                        return parseTemplate(template);
                    } else {
                        // assuming its a function that returns stream or string
                        return parseTemplate(template());
                    }
                } else {
                    return Promise.reject('Error fetching template');
                }
            }
        });
        mockContext.returns(Promise.resolve({}));
        server = http.createServer(tailor.requestHandler);
        server.listen(8080, 'localhost', done);
    });

    afterEach((done) => {
        mockContext.reset();
        mockTemplate.reset();
        server.close(done);
    });

    it('should return 500 if the layout wasn\'t found', (done) => {
        mockTemplate.returns(false);
        http.get('http://localhost:8080/missing-template', (response) => {
            assert.equal(response.statusCode, 500);
            response.resume();
            response.on('end', done);
        });
    });

    it('should return 500 if the template stream errored', (done) => {
        mockTemplate.returns(() => {
            const st = new PassThrough();
            setImmediate(() => st.emit('error', 'Something bad happened'));
            return st;
        });
        http.get('http://localhost:8080/missing-template', (response) => {
            assert.equal(response.statusCode, 500);
            response.resume();
            response.on('end', done);
        });

    });

    it('should stream content from http and https fragments', (done) => {

        nock('https://fragment')
            .get('/1').reply(200, 'hello');

        nock('http://fragment:9000')
            .get('/2').reply(200, 'world');

        mockTemplate
            .returns(
                '<html>' +
                '<fragment id="f-1" src="https://fragment/1">' +
                '<fragment id="f-2" src="http://fragment:9000/2">' +
                '</html>'
            );

        http.get('http://localhost:8080/test', (response) => {
            let result = '';
            assert.equal(response.statusCode, 200);
            response.on('data', (data) => {
                result += data;
            });
            response.on('end', () => {
                assert.equal(
                    result,
                    '<html>' +
                    '<div id="f-1">hello</div>' +
                    '<div id="f-2">world</div>' +
                    '</html>'
                );
                done();
            });
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
                '<html>' +
                '<fragment src="https://fragment/1"> ' +
                '<fragment src="https://fragment/2" primary> ' +
                '<fragment src="https://fragment/3" primary> ' +
                '</html>'
            );

        http.get('http://localhost:8080/test', (response) => {
            assert.equal(response.statusCode, 300);
            assert.equal(response.headers.location, 'https://redirect');
            response.resume();
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
            .returns('<fragment src="https://fragment/">');

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

    it('should set timeout for a fragment request', (done) => {
        nock('https://fragment')
            .get('/1').socketDelay(101).reply(200, 'hello')
            .get('/2').socketDelay(10001).reply(200, 'world');

        mockTemplate
            .returns(
                '<html>' +
                '<fragment src="https://fragment/1" timeout="100">' +
                '<fragment src="https://fragment/2">' +
                '</html>'
            );

        http.get('http://localhost:8080/test', (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                assert.equal(data, '<html></html>');
                done();
            });
        });
    });

    it('should return 500 in case of primary timeout', (done) => {
        nock('https://fragment')
            .get('/1').socketDelay(101).reply(200, 'hello');

        mockTemplate
            .returns(
                '<html>' +
                '<fragment src="https://fragment/1" primary timeout="100"> ' +
                '</html>'
            );

        http.get('http://localhost:8080/test', (response) => {
            assert.equal(response.statusCode, 500);
            response.resume();
            done();
        });
    });

    it('should return 500 in case of primary error', (done) => {
        nock('https://fragment')
            .get('/1').replyWithError('panic!');

        mockTemplate
            .returns(
                '<html>' +
                '<fragment src="https://fragment/1" primary> ' +
                '</html>'
            );

        http.get('http://localhost:8080/test', (response) => {
            assert.equal(response.statusCode, 500);
            response.resume();
            done();
        });
    });

    it('should insert link to css and require js from fragment link header', (done) => {
        nock('https://fragment')
            .get('/1').reply(200, 'hello', {
                'Link': '<http://link>; rel="stylesheet",<http://link2>; rel="fragment-script"'
            });

        mockTemplate
            .returns('<html><fragment id="f" src="https://fragment/1"></html>');

        http.get('http://localhost:8080/test', (response) => {
            let data = '';
            response.on('data', (chunk) =>  {
                data += chunk;
            });
            response.on('end', () => {
                assert.equal(data,
                    '<html>' +
                    '<link rel="stylesheet" href="http://link">' +
                    '<script>require(["http://link2"])</script>' +
                    '<div id="f">hello</div>' +
                    '<script>pipe("f", "http://link2")</script>' +
                    '</html>'
                );
                done();
            });
        });
    });

    it('should insert link to css and require js  from fragment x-amz-meta-link header', (done) => {
        nock('https://fragment')
            .get('/1').reply(200, 'hello', {
                'X-AMZ-META-LINK': '<http://link>; rel="stylesheet",<http://link2>; rel="fragment-script"'
            });

        mockTemplate
            .returns('<html><fragment id="f" src="https://fragment/1"></html>');

        http.get('http://localhost:8080/test', (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                assert.equal(data,
                    '<html>' +
                    '<link rel="stylesheet" href="http://link">' +
                    '<script>require(["http://link2"])</script>' +
                    '<div id="f">hello</div>' +
                    '<script>pipe("f", "http://link2")</script>' +
                    '</html>'
                );
                done();
            });
        });
    });

    it('should not wrap content from inline fragments', (done) => {
        nock('https://fragment')
            .get('/1').reply(200, 'hello', {
                'X-AMZ-META-LINK': '<http://link>; rel="stylesheet",<http://link2>; rel="fragment-script"'
            });

        mockTemplate
            .returns('<html><fragment id="f" inline src="https://fragment/1"></html>');

        http.get('http://localhost:8080/test', (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                assert.equal(data,
                    '<html>' +
                    '<link rel="stylesheet" href="http://link">' +
                    '<script>require(["http://link2"])</script>' +
                    'hello' +
                    '</html>'
                );
                done();
            });
        });
    });

    it('should support async fragments', (done) => {
        nock('https://fragment')
            .get('/1').reply(200, 'hello');

        mockTemplate
            .returns(
                '<html>' +
                '<body>' +
                '<fragment src="https://fragment/1" async id="f">' +
                '</body>' +
                '</html>'
            );

        http.get('http://localhost:8080/test', (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                assert.equal(data,
                    '<html>' +
                    '<body>' +
                    '<div id="f"></div>' +
                    '<div style="display:none;" id="async-f">hello</div>' +
                    '<script>pipe("f", false, true)</script>' +
                    '</body>' +
                    '</html>'
                );
                done();
            });
        });
    });

    it('should replace fragment url with the one from context', (done) => {
        nock('https://fragment')
            .get('/yes').reply(200, 'yes');

        mockTemplate
            .returns(
                '<html>' +
                '<fragment id="f-1" src="https://default/no">' +
                '</html>'
            );

        mockContext.returns(Promise.resolve({'f-1': 'https://fragment/yes'}));

        http.get('http://localhost:8080/test', (response) => {
            let result = '';
            assert.equal(response.statusCode, 200);
            response.on('data', (data) => {
                result += data;
            });
            response.on('end', () => {
                assert.equal(
                    result,
                    '<html>' +
                    '<div id="f-1">yes</div>' +
                    '</html>'
                );
                done();
            });
        });
    });
});
