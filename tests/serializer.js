'use strict';

const assert = require('assert');
const parse5 = require('parse5');
const adapter = parse5.treeAdapters.htmlparser2;
const CustomSerializer = require('../lib/serializer');

describe('Serializer', () => {
    const serializerOptions = {
        treeAdapter: adapter,
        slotMap: new Map(),
        pipeTags: ['script', 'fragment'],
        handleTags: ['x-tag', 'fragment']
    };
    const getSerializer = (template) => {
        const rootNode = parse5.parse(template, { treeAdapter: adapter });
        return new CustomSerializer(rootNode, serializerOptions);
    };

    it('should output serialized buffer array', () => {
        const template = '<blah></blah>';
        const serializedList = getSerializer(template).serialize();
        assert(serializedList instanceof Array);
    });

    it('should insert pipe placeholder before first tag from pipeBefore tags', () => {
        const template = `
            <html>
                <head>
                    <script></script>
                </head>
                <body></body>
            </html>
        `;
        const serializedList = getSerializer(template).serialize();
        assert.equal(serializedList[0].toString().trim(), '<html><head>');
        assert.deepEqual(serializedList[1], { placeholder: 'pipe' });
    });

    it('should output placeholder and closing tags for handle tags', () => {
        const template = '<x-tag></x-tag>';
        const serializedList = getSerializer(template).serialize();
        assert.deepEqual(serializedList[1], { attributes: {}, name: 'x-tag' });
        assert.deepEqual(serializedList[2], { closingTag: 'x-tag' });
    });

    it('should serialize attributes and child nodes inside handle tags', () => {
        const template = '<x-tag foo="bar"><div>hello</div></x-tag>';
        const serializedList = getSerializer(template).serialize();
        assert.deepEqual(serializedList[1], { attributes: { 'foo': 'bar' }, name: 'x-tag' });
        assert.equal(serializedList[2], '<div>hello</div>');
        assert.deepEqual(serializedList[3], { closingTag: 'x-tag' });
    });

    it('should insert async placeholder before end of body tag', () => {
        const template = '<body><x-tag></x-tag></body>';
        const serializedList = getSerializer(template).serialize();
        assert.equal(serializedList[0].toString().trim(), '<html><head></head><body>');
        assert.deepEqual(serializedList[3], { placeholder: 'async' });
        assert.equal(serializedList[4].toString().trim(), '</body></html>');
    });

    it('should support script based custom tags for inserting in head', () => {
        const template = '<script type="fragment" primary async src="https://example.com"></script>';
        const serializedList = getSerializer(template).serialize();
        assert.equal(serializedList[0].toString().trim(), '<html><head>');
        assert.equal(serializedList[1].toString().trim(), { placeholder: 'pipe' });
        assert.deepEqual(serializedList[2], { name: 'fragment', attributes: {
            type: 'fragment',
            primary: '',
            async: '',
            src: 'https://example.com'
        } });
        assert.equal(serializedList[4].toString().trim(), '</head><body></body></html>');
    });

});
