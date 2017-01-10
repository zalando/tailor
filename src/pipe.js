(function (doc, perf) { //eslint-disable-line no-unused-vars, strict
    var placeholders = {};
    var starts = {};
    var scripts = doc.getElementsByTagName('script');
    // To maintain if all fragments on the page are initialized
    var initState = [];
    var noop = function() {};
    var hooks = {
        onBeforeInit: noop,
        onAfterInit: noop,
        onDone: noop
    };

    function currentScript () {
        var script;
        for (var s = scripts.length - 1; s >= 0; s--) {
            script = scripts[s];
            if (script.hasAttribute('data-pipe')) {
                script.removeAttribute('data-pipe');
                return script;
            }
        }
    }

    function placeholder(index) {
        placeholders[index] = currentScript();
    }

    function start(index, script) {
        starts[index] = currentScript();
        if (script) {
            initState.push(index);
            require([script]);
        }
    }

    function end(index, script, attributes) {
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
            // Exposed fragment initialization Function/Promise
            var init = i && i.__esModule ? i.default : i;
            // early return
            if (typeof init !== 'function') {
                return;
            }

            function isPromise(obj) {
                return typeof obj === 'object'
                    && typeof obj.then === 'function';
            }

            function doInit(init, node) {
                hooks.onBeforeInit(attributes);
                var fragmentRendering = init(node);
                var handlerFn = function() {
                    initState.pop();
                    hooks.onAfterInit(attributes);
                    if (initState.length === 0) {
                        hooks.onDone();
                    }
                };
                // Check if the response from fragment is a Promise to allow lazy rendering
                if (isPromise(fragmentRendering)) {
                    fragmentRendering.then(handlerFn).catch(handlerFn);
                } else {
                    handlerFn();
                }
            }
            // Initialize the fragment on the DOM node
            doInit(init, node);
        });
    }
    /* @preserve - loadCSS: load a CSS file asynchronously. [c]2016 @scottjehl, Filament Group, Inc. Licensed MIT */
    function loadCSS(href) {
        var ss = doc.createElement('link');
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
        function loadCB() {
            if (ss.addEventListener) {
                ss.removeEventListener('load', loadCB );
            }
            ss.media = 'all';
        }
        // once loaded, set link's media back to `all` so that the stylesheet applies once it loads
        if (ss.addEventListener) {
            ss.addEventListener('load', loadCB);
        }
        ss.onloadcssdefined = onloadcssdefined;
        onloadcssdefined(loadCB);
        return ss;
    }

    function assignHook (hookName) {
        return function(cb) {
            hooks[hookName] = cb;
        };
    }

    return {
        placeholder: placeholder,
        start: start,
        end: end,
        loadCSS: loadCSS,
        onBeforeInit: assignHook('onBeforeInit'),
        onAfterInit: assignHook('onAfterInit'),
        onDone: assignHook('onDone')
    };
})(window.document, window.performance);
