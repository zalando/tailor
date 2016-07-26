'use strict';

const parse5 = require('parse5');
const adapter = parse5.treeAdapters.htmlparser2;
const CustomSerializer = require('./serializer');

module.exports = class Transform {

    constructor(handleTags, insertBeforePipeTags) {
        this.handleTags = handleTags;
        this.pipeTags = insertBeforePipeTags;
    }

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

    _pushText(nextNode, slot) {
        if (nextNode && adapter.isTextNode(nextNode)) {
            slot.push(nextNode);
        }
    }

};
