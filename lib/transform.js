'use strict';

const parse5 = require('parse5');
const treeAdapter = parse5.treeAdapters.htmlparser2;
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
    applyTransforms(baseTemplate, childTemplate, fullRendering) {
        const options = { treeAdapter };
        const rootNodes = fullRendering
            ? parse5.parse(baseTemplate, options)
            : parse5.parseFragment(baseTemplate, options);
        const slotMap =
            childTemplate && typeof childTemplate === 'string'
                ? this._groupSlots(parse5.parseFragment(childTemplate, options))
                : new Map();
        const serializerOptions = {
            treeAdapter,
            slotMap,
            pipeTags: this.pipeTags,
            handleTags: this.handleTags,
            fullRendering
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
        const slotMap = new Map([['default', []]]);
        const nodes = treeAdapter.getChildNodes(root);
        nodes.forEach(node => {
            if (!treeAdapter.isTextNode(node)) {
                const { slot = 'default' } = node.attribs;
                const slotNodes = slotMap.get(slot) || [];
                const updatedSlotNodes = [...slotNodes, node];
                slotMap.set(slot, updatedSlotNodes);
                this._pushText(node.next, updatedSlotNodes);
                delete node.attribs.slot;
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
        if (nextNode && treeAdapter.isTextNode(nextNode)) {
            slot.push(nextNode);
        }
    }
};
