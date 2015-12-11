'use strict';
const PassThrough = require('stream').PassThrough;
const parseTemplate = require('../lib/parse-template');
const assert = require('assert');

describe('parseTemplate', () => {

    it('returns a Stream', () => {
        assert(parseTemplate(() => '')('template') instanceof Promise);
    });

    it('re-emits an error from a template stream', (done) => {
        const template = new PassThrough();
        parseTemplate(() => '')(template).then((parsedTemplate) => {
            parsedTemplate.on('error', (err) => {
                assert.equal(err, 'something bad happened');
                done();
            });
        });
        setImmediate(() => template.emit('error', 'something bad happened'));
    });

});
