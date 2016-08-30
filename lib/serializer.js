'use strict';
const Serializer = require('parse5/lib/serializer');

module.exports = class CustomSerializer extends Serializer {

    constructor(node, options) {
        super(node, options);
        this.slotMap = options.slotMap;
        this.handleTags = options.handleTags;
        this.pipeTags = options.pipeTags;
        this.isPipeInserted = false;
        this.lastChildInserted = false;
        this.serializedList = [];
        this._serializeNode = this._serializeNode.bind(this);
        this.defaultSlotsInserted = false;
    }

    pushBuffer() {
        if (this.html !== '') {
            this.serializedList.push(new Buffer(this.html));
            this.html = '';
        }
    }

    serialize() {
        this._serializeChildNodes(this.startNode);
        this.pushBuffer();
        return this.serializedList;
    }

    _isPipeNode(node) {
        return this.pipeTags.indexOf(node.name) !== -1;
    }

    _isSlotNode(node) {
        if (node.name === 'slot') {
            return true;
        }
        const attribs = node.attribs;
        return node.name === 'script' &&
            attribs && attribs.type === 'slot';
    }

    _isSpecialNode(node) {
        if (this.handleTags.indexOf(node.name) !== -1) {
            return true;
        }
        const attribs = node.attribs;
        if (attribs && attribs.type) {
            return node.name === 'script' && this.handleTags.indexOf(attribs.type) !== -1;
        }
        return false;
    }

    _isLastChildOfBody(node) {
        const parentNode = node.parent;
        if (parentNode.name === 'body') {
            if (Object.is(node, parentNode.lastChild)) {
                return true;
            }
        }
        return false;
    }

    _serializeSpecial(node) {
        this.pushBuffer();
        let fragmentObj;
        if (this.handleTags.indexOf(node.name) !== -1) {
            fragmentObj = Object.assign({}, { name: node.name, attributes: node.attribs});
        } else {
            fragmentObj = Object.assign({}, { name: node.attribs.type, attributes: node.attribs});
        }
        this.serializedList.push(fragmentObj);
        this._serializeChildNodes(node);
        this.pushBuffer();
        this.serializedList.push({ closingTag: node.name });
    }

    _serializeSlot(node) {
        const slotName = node.attribs.name;
        if (slotName) {
            if (this.slotMap.has(slotName)) {
                const slots = this.slotMap.get(slotName);
                slots && slots.forEach(this._serializeNode);
            }
        } else {
            if (this.defaultSlotsInserted) {
                console.warn('Encountered duplicate Unnamed slots in the template - Skipping the node');
                return;
            }
            const defaultSlots = this.slotMap.get('default');
            this.defaultSlotsInserted = true;
            defaultSlots && defaultSlots.forEach(this._serializeNode);
        }
    }

    _serializePipe(node) {
        this.pushBuffer();
        this.serializedList.push({ placeholder: 'pipe' });
        this.isPipeInserted = true;
        this._serializeNode(node);
    }

    _serializeRest() {
        this.lastChildInserted = true;
        if (!this.defaultSlotsInserted) {
            const defaultSlots = this.slotMap.get('default');
            defaultSlots && defaultSlots.forEach(this._serializeNode);
        }
        this.pushBuffer();
        this.serializedList.push({ placeholder: 'async' });
    }

    _serializeChildNodes(parentNode) {
        const childNodes = this.treeAdapter.getChildNodes(parentNode);
        if (childNodes) {
            childNodes.forEach(this._serializeNode);
        }
    }

    _serializeNode(currentNode) {
        if (!this.isPipeInserted && this._isPipeNode(currentNode)) {
            this._serializePipe(currentNode);
        } else if (this._isSpecialNode(currentNode)) {
            this._serializeSpecial(currentNode);
        } else if (this._isSlotNode(currentNode)) {
            this._serializeSlot(currentNode);
        } else if (this.treeAdapter.isElementNode(currentNode)) {
            this._serializeElement(currentNode);
        } else if (this.treeAdapter.isTextNode(currentNode)) {
            this._serializeTextNode(currentNode);
        } else if (this.treeAdapter.isCommentNode(currentNode)) {
            this._serializeCommentNode(currentNode);
        } else if (this.treeAdapter.isDocumentTypeNode(currentNode)) {
            this._serializeDocumentTypeNode(currentNode);
        }
        // Push default slots and async placeholder before body
        if (!this.lastChildInserted && this._isLastChildOfBody(currentNode)) {
            this._serializeRest();
        }
    }

};
