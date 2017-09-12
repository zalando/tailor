'use strict';

const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noPreserveCache();

describe('Transform', () => {
    let Transform;
    let transformInstance;

    class MockSerializer {
        constructor(node, options) {
            this.node = node;
            this.options = options;
        }
        serialize() {}
    }

    let mockSerializer = sinon.spy(function() {
        return sinon.createStubInstance(MockSerializer);
    });
    const handleTags = ['x-tag'];
    const pipeTags = ['script'];

    beforeEach(() => {
        Transform = proxyquire('../lib/transform', {
            './serializer': mockSerializer
        });
        transformInstance = new Transform(handleTags, pipeTags);
    });

    afterEach(() => {
        mockSerializer.reset();
    });

    it('should make child Templates optional', () => {
        const childTemplate = '';
        transformInstance.applyTransforms('', childTemplate);
        assert.equal(mockSerializer.callCount, 1); // No errros are thrown
    });

    it('should put tags in default slot if type is not defined', () => {
        const childTemplate = '<custom slot="" name="custom element"></custom>';
        transformInstance.applyTransforms('', childTemplate);
        const slotMap = mockSerializer.args[0][1].slotMap;
        assert(slotMap.has('default'));
    });

    it('should group slots based on slot types for child Templates', () => {
        const childTemplate = `
            <meta slot="head">
            <custom name="custom element"></custom>
            <fragment slot="body"></fragment>
        `;
        transformInstance.applyTransforms('', childTemplate);
        const slotMap = mockSerializer.args[0][1].slotMap;
        assert.equal(slotMap.size, 3);
        assert.ok(slotMap.get('default'));
        assert.ok(slotMap.has('head'));
        assert.ok(slotMap.has('body'));
    });

    it('should group text nodes along with the childTemplate nodes', () => {
        const childTemplate = `
            <meta slot="head">
            <fragment></fragment>
        `;
        transformInstance.applyTransforms('', childTemplate);
        const slotMap = mockSerializer.args[0][1].slotMap;
        assert.equal(slotMap.size, 2);
        // Text node that symbolizes next line of HTML
        assert.equal(slotMap.get('default')[1].type, 'text');
        assert.equal(slotMap.get('head')[1].type, 'text');
    });

    it('should call serializer with proper options', () => {
        transformInstance.applyTransforms('', '');
        const options = mockSerializer.args[0][1];
        assert(options.slotMap instanceof Map);
        assert(options.treeAdapter instanceof Object);
        assert.equal(options.pipeTags, pipeTags);
        assert.equal(options.handleTags, handleTags);
    });
});
