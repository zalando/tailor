'use strict';
const Serializer = require('parse5/lib/serializer');

module.exports = class CustomSerializer extends Serializer {
    
    constructor(node, options) {
        super(node, options);
        this.slotMap = options.slotMap;
        this.fragmentTag = options.fragmentTag;
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

    _isFragmentNode(node) {
        return node.name === this.fragmentTag;
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

    _serializeFragment(node) {
        this.pushBuffer();
        const fragmentObj = Object.assign({}, { name: this.fragmentTag }, { attributes: node.attribs});
        this.serializedList.push(fragmentObj);
    }

    _serializeSlotGroups(slots) {
        if (slots) {
            slots.forEach((slot) =>  {
                if (this._isFragmentNode(slot)) {
                    this._serializeFragment(slot);
                } else if (this.treeAdapter.isTextNode(slot)) {
                    this._serializeTextNode(slot);
                } else {
                    this._serializeElement(slot);
                }
            });
        }
    }

    _serializeSlot(node) {
        const slotName = node.attribs.name;
        if (this.slotMap.has(slotName)) {
            const slots = this.slotMap.get(slotName);
            this._serializeSlotGroups(slots);
        }
    }

    _serializePipe(node) {
        this.pushBuffer();
        this.serializedList.push({ placeholder: 'pipe' });
        this.isPipeInserted = true;
        this._serializeElement(node);
    }

    _serializeRest() {
        this.pushBuffer();
        const bodySlots = this.slotMap.get('body');
        this._serializeSlotGroups(bodySlots);
        this.serializedList.push({ placeholder: 'async' });
    }

    _serializeChildNodes(parentNode) {
        const childNodes = this.treeAdapter.getChildNodes(parentNode);

        childNodes.forEach((currentNode) => {
            if (this._isSlotNode(currentNode)) {
                this._serializeSlot(currentNode);
            } else if (this._isPipeNode(currentNode)) {
                this._serializePipe(currentNode);
            } else if (this._isFragmentNode(currentNode)) {
                this._serializeFragment(currentNode);
            } else if (this._isLastChildOfBody(currentNode)) {
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
        });
    }
   
};