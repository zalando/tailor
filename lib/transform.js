'use strict';

const parse5 = require('parse5');
const adapter = parse5.treeAdapters.htmlparser2;
const CustomSerializer = require('./serializer');

/**
 * Handles the parsing and serialization of templates. Also takes care of
 * merging the base and page templates
 */

module.exports = class Transform {

    constructor(handleTags, insertBeforePipeTags) {
        this.handleTags = handleTags;
        this.pipeTags = insertBeforePipeTags;
    }

    /**
     * Parse and serialize the html.
     *
     * @param {string} baseTemplate - Base template that contains all the necessary tags and fragments for the given page (Used by multiple pages)
     * @param {string=} childTemplate - The current page template that gets merged in to the base template
     * @returns {Array} Array consiting of Buffers and Objects
     */
    applyTransforms(baseTemplate, childTemplate) {
        let rootNodes = parse5.parse(baseTemplate, { treeAdapter: adapter });
        let slotMap = new Map();
        if (childTemplate && typeof childTemplate === 'string') {
            const childNodes = parse5.parseFragment(childTemplate, { treeAdapter: adapter });
            slotMap = this._groupSlots(childNodes);
        }
        const serializerOptions = {
            treeAdapter : adapter,
            slotMap: slotMap,
            pipeTags: this.pipeTags,
            handleTags: this.handleTags
        };
        const serializer = new CustomSerializer(rootNodes, serializerOptions);
        return serializer.serialize();
    }
    /**
     * Group all the nodes after parsing the child template. Nodes with unnamed slots are
     * added to default slots
     *
     * @param {Object} root - The root node of the child template
     * @returns {Map} Map with keys as slot attribute name and corresponding values consisting of array of matching nodes
     */
    _groupSlots(root) {
        const slotMap = new Map();
        slotMap.set('default', []);
        const nodes = adapter.getChildNodes(root);
        nodes.forEach((node) => {
            if (adapter.isTextNode(node)) {
                return;
            }
            const attribs = node.attribs;
            if (attribs && attribs.slot) {
                if (slotMap.has(attribs.slot)) {
                    slotMap.get(attribs.slot).push(node);
                } else {
                    slotMap.set(attribs.slot, [node]);
                }
                this._pushText(node.next, slotMap.get(attribs.slot));
                delete attribs.slot;
            } else {
                slotMap.get('default').push(node);
                this._pushText(node.next, slotMap.get('default'));
            }
        });
        return slotMap;
    }

    /**
     * Add the text node to the Slot Map
     *
     * @param {Object} nextNode
     * @param {Array} slot - Array of matching nodes
     */
    _pushText(nextNode, slot) {
        if (nextNode && adapter.isTextNode(nextNode)) {
            slot.push(nextNode);
        }
    }

};
