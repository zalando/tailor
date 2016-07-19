'use strict';
const Serializer = require('parse5/lib/serializer');

module.exports = class CustomSerializer extends Serializer {
    
    constructor(node, options) {
        super(node, options);
        this.slotMap = options.slotMap;
        this.handleTags = options.handleTags;
        this.pipeTags = options.pipeTags;
        this.isPipeInserted = false;
        this.serializedList = [];
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
        return !this.isPipeInserted && this.pipeTags.indexOf(node.name) !== -1;
    }

    _isSlotNode(node) {
        const attribs = node.attribs;
        if (!attribs) {
            return false;
        }
        return node.name === 'script' && attribs.type === 'slot';
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
            const childNodes = this.treeAdapter.getChildNodes(parentNode);
            if (Object.is(node, childNodes[childNodes.length - 1])) {
                return true;
            }
        }
        return false;
    }

    _serializeSpecial(node) {
        this.pushBuffer();
        let fragmentObj;
        if (this.handleTags.indexOf(node.name) !== -1) {
            fragmentObj = Object.assign({}, { name: node.name }, { attributes: node.attribs});
        }  else {
            fragmentObj = Object.assign({}, { name: node.attribs.type }, { attributes: node.attribs});
        }
        this.serializedList.push(fragmentObj);
    }

    _serializeSlot(node) {
        const slotName = node.attribs.name;
        if (this.slotMap.has(slotName)) {
            const slots = this.slotMap.get(slotName);
            if (slots) {
                slots.forEach(slot => this._serializeNode(slot));
            }
        }
    }

    _serializePipe(node) {
        this.pushBuffer();
        this.serializedList.push({ placeholder: 'pipe' });
        this.isPipeInserted = true;
        this._serializeNode(node);
    }

    _serializeRest(node) {
        this._serializeNode(node, false);
        this.pushBuffer();
        const defaultSlots = this.slotMap.get('default');
        if (defaultSlots) {
            defaultSlots.forEach(slot => this._serializeNode(slot));
        }
        this.serializedList.push({ placeholder: 'async' });
    }

    _serializeChildNodes(parentNode) {
        const childNodes = this.treeAdapter.getChildNodes(parentNode);
        if (childNodes) {
            childNodes.forEach(node => this._serializeNode(node));
        }
    }

    _serializeNode(currentNode, lastChildFlag = true) {
        if (this._isPipeNode(currentNode)) {
            this._serializePipe(currentNode);
        } else if (this._isSpecialNode(currentNode)) {
            this._serializeSpecial(currentNode);
        } else if (this._isSlotNode(currentNode)) {
            this._serializeSlot(currentNode);
        } else if (lastChildFlag && this._isLastChildOfBody(currentNode)) {
            this._serializeRest(currentNode);
        } else if (this.treeAdapter.isElementNode(currentNode)) {
            this._serializeElement(currentNode);
        } else if (this.treeAdapter.isTextNode(currentNode)) {
            this._serializeTextNode(currentNode);
        } else if (this.treeAdapter.isCommentNode(currentNode)) {
            this._serializeCommentNode(currentNode);
        } else if (this.treeAdapter.isDocumentTypeNode(currentNode)) {
            this._serializeDocumentTypeNode(currentNode);
        }
    }
   
};