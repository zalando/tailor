'use strict';
const parseTemplate = require('../lib/parse-template');
const assert = require('assert');
const parseTempatePartial = parseTemplate([], []);

describe('parseTemplate', () => {
    it('returns a Promise', () => {
        assert(parseTempatePartial('template') instanceof Promise);
    });

    it('should reject with error for invalid templates', () => {
        const template = () => new Error('throw');
        parseTempatePartial(template()).catch(err => {
            assert(err instanceof Error);
        });
    });

    it('should parse templates with comments inside', done => {
        parseTempatePartial('<div></div>', '<!-- nice comment -->')
            .then(() => done())
            .catch(done);
    });
});
