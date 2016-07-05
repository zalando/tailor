'use strict';

const parse5 = require('parse5');
const adapter = parse5.treeAdapters.htmlparser2;

const getFragment = (node, attribs) => {
    const fragmentObj = {};
    fragmentObj.name = 'fragment';
    Object.assign(fragmentObj, attribs);
    return fragmentObj;
};

module.exports = class Transform {

    constructor(fragmentTag, optionalTransforms) {
        this.fragmentTag = fragmentTag;
        this.pipeTags = ['script', this.fragmentTag];
        this.transforms = [ this.slotTransform, this.defaultTransform ];
        if (typeof optionalTransforms === 'function') {
            this.transforms.push(optionalTransforms);
        }
        this.locations = [];
        this.isPipeInserted = false;
        this.headSlots = [];
    }

    isFragment(node) {
        return adapter.getTagName(node) === this.fragmentTag;
    }

    getBufferList(html) {
        const chunks = [];
        const firstChunk = html.substring(0, this.locations[0].startOffset); 
        chunks.push(firstChunk);
        this.locations.forEach(({ startOffset, endOffset }) => {
            const currChunk = html.substring(startOffset, endOffset);
            chunks.push(currChunk);
        });
        const lastChunk = html.substring(this.locations[this.locations.length - 1].endOffset);
        chunks.push(lastChunk);
        return chunks;
    }

    getSlots(root, slotName) {
        const nodes = adapter.getChildNodes(root);
        const namedSlot = [];
        const rest = [];
        nodes.forEach(node => {
            adapter.detachNode(node);
            const attribs = node.attribs;
            if (attribs && attribs.slot === slotName) {
                namedSlot.push(node);
            } else {
                rest.push(node);
            }
        });
        return namedSlot, rest;
    }

    mergeNodes(baseNodes, childNodes) {
        this.walkTheDOM(baseNodes, (node) => {
            if (adapter.getTagName(node) === 'body') {
                childNodes.forEach((n) => {
                    adapter.appendChild(node, n);
                });
            }
        });
        return baseNodes;
    }

    applyTransforms(baseTemplate, childTemplate) {
        let rootNodes = parse5.parse(baseTemplate, { locationInfo: true, treeAdapter: adapter });
        if (typeof childTemplate === 'string') {
            const childNodes = parse5.parseFragment(childTemplate, { locationInfo: true, treeAdapter: adapter }).childNodes;
            rootNodes = this.mergeNodes(rootNodes, childNodes);
            console.log(parse5.serialize(rootNodes, {treeAdapter: adapter}));
        }
        this.transforms.forEach((fn) => this.walkTheDOM(rootNodes, fn));
        const html = parse5.serialize(rootNodes, { treeAdapter: adapter });
        const bufferList = this.getBufferList(html);
        return bufferList;
    }

    defaultTransform(node) {
        if (adapter.getTagName(node) === 'head') {
            let lastChild = node.lastChild;
            this.headSlots.forEach(slotNode => {
                const { endOffset } = lastChild['__location'];
                const length = slotNode['__location'].endOffset -  slotNode['__location'].startOffset;
                // Override to make sure the offset is proper
                slotNode['__location'].startOffset = endOffset;
                slotNode['__location'].endOffset = endOffset + length;
                if (this.isFragment(slotNode)) {
                    const { startOffset, endOffset } = slotNode['__location'];
                    this.locations.push({ startOffset, endOffset, slotNode });
                }
                adapter.detachNode(slotNode);
                adapter.appendChild(node, slotNode);
                lastChild = slotNode;
            });
        }
        // Placeholder for frontend piping
        if (!this.isPipeInserted && this.pipeTags.indexOf(node.name) !== -1) {
            const attributes = [{ name: 'placeholder', value: 'pipe' }];
            const pipeEle = adapter.createElement('script', null, attributes);
            const pipeLocation = getLocation(node, node.prev);
            this.locations.push(Object.assign(pipeLocation, {'node': pipeEle}));
            adapter.insertBefore(node.parent, pipeEle, node);
            this.isPipeInserted = true;
        }
        // Placeholder for async stream
        if (adapter.getTagName(node) === 'body') {
            const attributes = [{ name: 'placeholder', value: 'async' }];
            const asyncEle = adapter.createElement('script', null, attributes);
            const asyncLocation = getLocation(node.lastChild, node.lastChild.prev);
            this.locations.push(Object.assign(asyncLocation, {'node': asyncEle}));
            adapter.insertBefore(node.lastChild, asyncEle);
        }
        if (this.isFragment(node) && adapter.getTagName(node.parent) !== 'head') {
            const { startOffset, endOffset } = node['__location'];
            this.locations.push({ startOffset, endOffset, node });
        }
    }

    slotTransform(node) {
        if (node.parent && node.parent.name !== 'body') {
            return;
        }
        const slotName = node.attribs !== undefined ? node.attribs.slot : '';
        if (slotName && slotName === 'head') {
            this.headSlots.push(node);
        }
    }

    walkTheDOM(node, func) {
        if (node.name) {
            func.call(this, node);
        }
        node = node.firstChild;
        while (node) {
            this.walkTheDOM(node, func);
            node = node.next;
        }
    }
};
