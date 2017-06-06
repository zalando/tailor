'use strict';
const Serializer = require('parse5/lib/serializer');
/**
 * CustomSerializer Class
 *
 * It uses the serializer from parse5 and overrides the serialize functions for handling
 * the tags that are passed via handleTags and piping.
 *
 * All the default nodes like <div>, <head> go to parse5 serializer
 * and the rest are handled in this class.
 *
 * Node - Represets DOM Tree
 */
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

    /**
     * Push the serialized content in to the serializedList.
     *
     * this.html - serialized contents exposed by parse5
     */
    pushBuffer() {
        if (this.html !== '') {
            this.serializedList.push(Buffer.from(this.html));
            this.html = '';
        }
    }

    /**
     * Extract the serialized HTML content and reset the serialized buffer.
     *
     * @returns {String}
     */
    getHtmlContent() {
        let temp = '';
        if (this.html !== '') {
            temp = this.html;
            this.html = '';
        }
        return temp;
    }

    /**
     * Overidden the serialize function of parse5 Serializer
     *
     * this.startNode - Denotes the root node
     * @returns {Array}
     */
    serialize() {
        this._serializeChildNodes(this.startNode);
        this.pushBuffer();
        return this.serializedList;
    }

    /**
     * Checks if the node satifies the placeholder for `piping`
     *
     * @returns {Boolean}
     */
    _isPipeNode(node) {
        return this.pipeTags.includes(node.name);
    }

    /**
     * Checks if the node is either slot node / script type=slot
     *
     * @returns {Boolean}
     */
    _isSlotNode(node) {
        const { attribs = {}, name } = node;
        return (name === 'slot') ||
            (name === 'script' && attribs.type === 'slot');
    }

    /**
     * Checks if the node is one of the nodes passed through handleTags
     *
     * @returns {Boolean}
     */
    _isSpecialNode(node) {
        const { attribs = {}, name } = node;
        return this.handleTags.includes(name) ||
            (name === 'script' && this.handleTags.includes(attribs.type));
    }

    /**
     * Checks if the node is the lastChild of <body>
     *
     * @returns {Boolean}
     */
    _isLastChildOfBody(node) {
        const { parentNode: { name, lastChild } } = node;
        return (name === 'body' && Object.is(node, lastChild));
    }

    /**
     * Serialize the nodes passed via handleTags
     *
     * @param {object} node
     *
     * // Input
     * <fragment src="http://example.com" async primary></fragment>
     *
     * // Output
     * {
     *    name: 'fragment',
     *    attributes: {
     *       async: '',
     *       primary: ''
     *    },
     * }
     */
    _serializeSpecial(node) {
        this.pushBuffer();
        let handledObj;
        const { name, attribs: attributes } = node;
        if (this.handleTags.includes(name)) {
            handledObj = Object.assign({}, { name: name, attributes });
            this.serializedList.push(handledObj);
            this._serializeChildNodes(node);
            this.pushBuffer();
        } else {
            // For handling the script type other than text/javascript
            this._serializeChildNodes(node);
            handledObj = Object.assign({}, {
                name: attributes.type,
                attributes,
                textContent: this.getHtmlContent()
            });
            this.serializedList.push(handledObj);
        }
        this.serializedList.push({ closingTag: name });
    }

    /**
     * Serialize the slot nodes from the slot map
     *
     * @param {object} node
     */
    _serializeSlot(node) {
        const slotName = node.attribs.name;
        if (slotName) {
            const childNodes = this.treeAdapter.getChildNodes(node);
            const slots = this.slotMap.has(slotName) ? this.slotMap.get(slotName) : childNodes;
            slots && slots.forEach(this._serializeNode);
        } else {
            // Handling duplicate slots
            if (this.defaultSlotsInserted) {
                console.warn('Encountered duplicate Unnamed slots in the template - Skipping the node');
                return;
            }
            const defaultSlots = this.slotMap.get('default');
            this.defaultSlotsInserted = true;
            defaultSlots && defaultSlots.forEach(this._serializeNode);
        }
    }

    /**
     * Insert the pipe placeholder and serialize the node
     *
     * @param {object} node
     */
    _serializePipe(node) {
        this.pushBuffer();
        this.serializedList.push({ placeholder: 'pipe' });
        this.isPipeInserted = true;
        this._serializeNode(node);
    }

    /**
     * Serialize the nodes in default slot from slot map and insert async placeholder.
     *
     * should happen before closing the body.
     */
    _serializeRest() {
        this.lastChildInserted = true;
        if (!this.defaultSlotsInserted) {
            const defaultSlots = this.slotMap.get('default');
            defaultSlots && defaultSlots.forEach(this._serializeNode);
        }
        this.pushBuffer();
        this.serializedList.push({ placeholder: 'async' });
    }

    /**
     * Serialize all the children of a parent node.
     *
     * @param {object} parentNode
     */
    _serializeChildNodes(parentNode) {
        const childNodes = this.treeAdapter.getChildNodes(parentNode);
        childNodes && childNodes.forEach(this._serializeNode);
    }

    /**
     * Serialize the node based on their type
     *
     * @param {object} currentNode
     */
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
