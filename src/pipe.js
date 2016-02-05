function Pipe (require) { //eslint-disable-line no-unused-vars, strict
    var placeholders = {};
    var starts = {};
    var scripts = document.getElementsByTagName('script');
    function currentScript () {
        return scripts[scripts.length - 1];
    };
    function placeholder (index) {
        placeholders[index] = currentScript();
    }
    function start (index, script) {
        starts[index] = currentScript();
        script && require([script]);
    }
    function end (index, script) {
        var placeholder = placeholders[index];
        var start = starts[index];
        var end = currentScript();
        var node;
        var nextNode = start;
        if (placeholder) {
            // move everything from start to end into the placeholder
            do {
                node = nextNode;
                nextNode = nextNode.nextSibling;
                placeholder.parentNode.insertBefore(node, placeholder);
            } while (node !== end);
            placeholder.parentNode.removeChild(placeholder);
        }
        node = start.nextSibling;
        while (node && node.nodeType !== 1) {
            node = node.nextSibling;
        }
        if (node === end) {
            // ensure we don't initialize with script element
            node = undefined;
        }
        start.parentNode.removeChild(start);
        end.parentNode.removeChild(end);
        script && require([script], function (i) {
            var init = i && i.__esModule ? i.default : i;
            if (typeof init === 'function') {
                init(node);
            }
        });
    }
    return {
        placeholder: placeholder,
        start: start,
        end: end
    };
}
