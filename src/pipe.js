var Pipe = (function (doc) { //eslint-disable-line no-unused-vars, strict
    return function (require) {
        var placeholders = {};
        var starts = {};
        var scripts = doc.getElementsByTagName('script');
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
        /* @preserve - loadCSS: load a CSS file asynchronously. [c]2016 @scottjehl, Filament Group, Inc. Licensed MIT */
        function loadCSS (href) {
            var ss = doc.createElement('link');
            var media = 'all';
            var ref;
            var refs = (doc.body || doc.getElementsByTagName('head')[0]).childNodes;
            ref = refs[refs.length - 1];

            var sheets = doc.styleSheets;
            ss.rel = 'stylesheet';
            ss.href = href;
            // temporarily set media to something inapplicable to ensure it'll fetch without blocking render
            ss.media = 'only x';

            // wait until body is defined before injecting link. This ensures a non-blocking load in IE11.
            function ready (cb) {
                if (doc.body) {
                    return cb();
                }
                setTimeout(function() {
                    ready( cb );
                });
            }
            // Inject link
            // Note: `insertBefore` is used instead of `appendChild`, for safety re: http://www.paulirish.com/2011/surefire-dom-element-insertion/
            ready(function() {
                ref.parentNode.insertBefore(ss, ref.nextSibling);
            });
            // A method (exposed on return object for external use) that mimics onload by polling until document.styleSheets until it includes the new sheet.
            var onloadcssdefined = function (cb) {
                var resolvedHref = ss.href;
                var i = sheets.length;
                while (i--) {
                    if (sheets[i].href === resolvedHref) {
                        return cb();
                    }
                }
                setTimeout(function() {
                    onloadcssdefined(cb);
                });
            };
            // once loaded, set link's media back to `all` so that the stylesheet applies once it loads
            if (ss.addEventListener) {
                ss.addEventListener('load', function() {
                    this.media = media;
                });
            }
            ss.onloadcssdefined = onloadcssdefined;
            onloadcssdefined(function() {
                if (ss.media !== media) {
                    ss.media = media;
                }
            });
            return ss;
        }
        return {
            placeholder: placeholder,
            start: start,
            end: end,
            loadCSS: loadCSS
        };
    };
})(window.document);
