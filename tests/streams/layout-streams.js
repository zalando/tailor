'use strict';
const PassThrough = require('stream').PassThrough;
const assert = require('assert');
const ParserStream = require('../../lib/streams/parser-stream');
const StringifierStream = require('../../lib/streams/stringifier-stream');
const lazypipe = require('lazypipe');


function streamy (specialTagsOrFn, pipeBeforeTagsOrFn, maybeFn) {
    let specialTags;
    let pipeBeforeTags;
    let fn;
    if (typeof specialTagsOrFn === 'function') {
        specialTags = ['fragment'];
        pipeBeforeTags = [];
        fn = specialTagsOrFn;
    } else if (typeof pipeBeforeTagsOrFn === 'function')  {
        specialTags = specialTagsOrFn || ['fragment'];
        pipeBeforeTags = [];
        fn = pipeBeforeTagsOrFn;
    } else {
        specialTags = specialTagsOrFn || ['fragment'];
        pipeBeforeTags = pipeBeforeTagsOrFn || [];
        fn = maybeFn;
    }
    return (lazypipe()
            .pipe((tags, pipeTags) => new ParserStream(tags, pipeTags), specialTags, pipeBeforeTags)
            .pipe((f) => new StringifierStream(f), fn)
    )();
};

describe('Layout Streams', () => {

    it('should stream the content from a fragment tag', (done) => {
        let data = '';
        let st = new PassThrough();

        let stream = streamy((tag) => {
            if (tag && tag.name) {
                assert.deepEqual(tag.attributes, {title: 'mock'});
                return st;
            }
            return '';
        });

        stream.on('data', (chunk) => {
            data += chunk;
        });
        stream.on('end', () => {
            assert.equal(data, 'mock');
            done();
        });
        stream.end('<fragment title="mock">');
        st.end('mock');
    });

    it('should consume streams asynchrously', (done) => {
        let data = '';
        let streams = [new PassThrough(), new PassThrough()];
        let stream = streamy( (tag) => {
            if (tag && tag.name) {
                return streams[tag.attributes.id - 1];
            } else {
                return '';
            }
        });
        stream.on('data', (chunk) => {
            data += chunk;
        });
        stream.on('end', () => {
            assert.equal(data, '<html>12</html>');
            done();
        });
        stream.write('<html>');
        stream.write('<fragment id="1">');
        stream.write('<fragment id="2">');
        stream.end('</html>');
        setTimeout( () => {
            streams[0].end('1');
        }, 10);
        streams[1].end('2');
    });

    it('should emit an error if a fragment is not handled', (done) => {
        let stream = streamy();
        stream.on('error', (error) => {
            assert(error instanceof Error);
            done();
        });
        stream.end('<fragment>');
    });

    it('should emit an error from a fragment handler', (done) => {
        let stream = streamy( () => {
            throw new Error('sorry!');
        });
        stream.on('error', (error) => {
            assert.equal(error.message, 'sorry!');
            done();
        });
        stream.end('<fragment>');
    });

    it('should re-emit errors from fragment streams', (done) => {
        let st = new PassThrough();
        let stream = streamy((tag) => {
            if (tag) {
                return st;
            }
        });
        stream.on('error', (error) => {
            assert.equal(error.message, 'sorry!');
            done();
        });
        stream.end('<fragment>');
        st.emit('error', new Error('sorry!'));
        st.end('data');
    });


    it('should ask for pipe placeholder before the first tag from pipeBeforeTags', (done) => {
        let data = '';
        let stream = streamy(['fragment'], ['script'], (tag) => {
            if (tag.name) {
                return 'tag';
            } if (tag.closingTag) {
                return 'close';
            } else if (tag.placeholder === 'pipe') {
                return 'pipe';
            } else {
                return '';
            }
        });
        stream.on('end', () => {
            assert.equal(data, '<html><body>pipe<script></script><script></script>tagclose</body></html>');
            done();
        });
        stream.on('data', (chunk) => {
            data += chunk;
        });
        stream.end('<html><body><script></script><script></script><fragment></body></html>');
    });


    it('should ask for more content before closing body', (done) => {
        let data = '';
        let stream = streamy( (tag) => {
            if (tag.name) {
                return 'tag';
            } if (tag.closingTag) {
                return 'close';
            } else if (tag.placeholder === 'async') {
                return 'body';
            } else {
                return '';
            }
        });
        stream.on('end', () => {
            assert.equal(data, '<html><body>tagclosebody</body></html>');
            done();
        });
        stream.on('data', (chunk) => {
            data += chunk;
        });
        stream.end('<html><body><fragment></body></html>');
    });

    it('should not swallow script contents', (done) => {
        let data = '';
        let stream = streamy();
        stream.on('end', () => {
            assert.equal(data, '<html><body><script>alert("hello!")</script></body></html>');
            done();
        });
        stream.on('data', (chunk) => {
            data += chunk;
        });
        stream.end('<html><body><script>alert("hello!")</script></body></html>');
    });

    it('should be possible to define the special tags', (done) => {
        let data = '';

        let stream = streamy(['foo', 'bar'], (tag) => {
            if (tag.placeholder) {
                return '';
            } else {
                return tag.attributes.title;
            }
        });

        stream.on('data', (chunk) => {
            data += chunk;
        });
        stream.on('end', () => {
            assert.equal(data, 'foo<fragment title="fragment">bar');
            done();
        });
        stream.end('<foo title="foo"><fragment title="fragment"><bar title="bar">');
    });

    it('should notify on closing tags as well', (done) => {
        let data = '';

        let stream = streamy(['test'], (tag) => {
            if (tag.name === 'test') {
                return 'testOpen';
            } else if (tag.closingTag === 'test') {
                return 'testClose';
            } else {
                return '';
            }
        });

        stream.on('data', (chunk) => {
            data += chunk;
        });
        stream.on('end', () => {
            assert.equal(data, 'testOpen-inside-testClose');
            done();
        });
        stream.end('<test>-inside-</test>');
    });

    it('should correctly serialize doctype', (done) => {
        let data = '';
        let stream = streamy();
        stream.on('data', (chunk) => {
            data += chunk;
        });
        stream.on('end', () => {
            assert.equal(data, '<!DOCTYPE html>');
            done();
        });
        stream.end('<!DOCTYPE html>');
    });

});
