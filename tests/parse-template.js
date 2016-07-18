'use strict';
const parseTemplate = require('../lib/parse-template');
const assert = require('assert');

describe('parseTemplate', () => {

    it('returns a Promise', () => {
        assert(parseTemplate('')('template') instanceof Promise);
    });

    it('should reject with error for invalid templates', () => {
        const template = () => new Error('throw');
        parseTemplate('')(template()).catch((err)=> {
            assert(err instanceof Error);
        });
    });

    it('should support partial templates using slots', (done) => {
        const template = '<script type="slot" name="head"></script>';
        const childTemplate = '<meta slot="head"/>';
        parseTemplate('')(template, childTemplate).then((parsedTemplate) => {
            const result = '<html><head><meta slot="head"></head><body></body></html>';
            assert.equal(result, parsedTemplate.toString());
            done();
        });
    });

});
