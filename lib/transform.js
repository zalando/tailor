'use strict';

const parse5 = require('parse5');
const adapter = parse5.treeAdapters.htmlparser2;
const CustomSerializer = require('./serializer');

module.exports = class Transform {

    constructor(pipeTags, fragmentTag) {
        this.pipeTags = pipeTags;
        this.fragmentTag = fragmentTag;
    }

    applyTransforms(baseTemplate, childTemplate) {
        let rootNodes = parse5.parse(baseTemplate, { treeAdapter: adapter });
        let slotMap = new Map();
        if (typeof childTemplate === 'string') {
            const childNodes = parse5.parseFragment(childTemplate, { treeAdapter: adapter });
            slotMap = this._groupSlots(childNodes);
        }
        const options = {
            treeAdapter : adapter,
            slotMap: slotMap,
            pipeTags: this.pipeTags,
            fragmentTag: this.fragmentTag
        };
        const serializer = new CustomSerializer(rootNodes, options);
        return serializer.serialize();
    }

    _groupSlots(root) {
        const slotMap = new Map();
        slotMap.set('body', []);
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
                this._pushNext(node.next, slotMap.get(attribs.slot));
            } else {
                slotMap.get('body').push(node);
                this._pushNext(node.next, slotMap.get('body'));
            }
        });
        return slotMap;
    }

    _pushNext(nextNode, slot) {
        if (nextNode && adapter.isTextNode(nextNode)) {
            slot.push(nextNode);
        }
    }
    
};
