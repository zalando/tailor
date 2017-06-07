(function (doc, perf) { //eslint-disable-line no-unused-vars, strict
    var placeholders = {};
    var starts = {};
    var scripts = doc.getElementsByTagName('script');
    // State to maintain if all fragments on the page are initialized
    var initState = [];
    var noop = function() {};
    // Hooks that will be replaced later on the page
    var hooks = {
        onStart: noop,
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

    function arrayMath(array, mathFn) {
        return Math[mathFn].apply(null, array);
    }

    function arrayFlatten(array) {
        return [].concat.apply([], array);
    }

    function arrayOf(val, size) {
        var result = [];
        for (var i = size; i--; i >= 0) {
            result[i] = val;
        }
        return result;
    }

    // setChunkInitPhase keeps track of initialization phases
    function setChunkInitPhase(index, attributes, phase) {
        var chunkIndex = index - attributes.range[0];
        initState[attributes.fragmentID][chunkIndex] = phase;
    }

    function chunkHook(attributes, hook) {
        var fragmentID = attributes.fragmentID;
        switch (hook) {
            case 'onStart':
                if (!initState[attributes.fragmentID]) {
                    initState[attributes.fragmentID] = arrayOf(0, attributes.range);
                    hooks.onStart(attributes);
                }
                break;
            case 'onBeforeInit':
                var chunkMax = arrayMath(initState[fragmentID], 'max');
                chunkMax < 2 && hooks.onBeforeInit(attributes);
                break;
            case 'onAfterInit':
                var chunkMax = arrayMath(initState[fragmentID], 'max');
                chunkMax < 3 && hooks.onAfterInit(attributes);
                break;
            case 'onDone':
                var allChunksMin = arrayMath(arrayFlatten(initState), 'min');
                allChunksMin > 2 && hooks.onDone();
                break;

        }
    }

    function placeholder(index) {
        placeholders[index] = currentScript();
    }

    function start(index, script, attributes) {
        starts[index] = currentScript();
        if (script) {
            chunkHook(attributes, 'onStart');
            setChunkInitPhase(index, attributes, 1);
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
                var fragmentRendering = init(node);
                chunkHook(attributes, 'onBeforeInit');
                setChunkInitPhase(index, attributes, 2);
                var handlerFn = function() {
                    chunkHook(attributes, 'onAfterInit');
                    setChunkInitPhase(index, attributes, 3);
                    // OnDone will be called once the document is completed parsed and there are no other fragments getting streamed.
                    if (doc.readyState
                        && (doc.readyState === 'complete'
                        || doc.readyState === 'interactive')) {
                        chunkHook(attributes, 'onDone');
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
        onStart: assignHook('onStart'),
        onBeforeInit: assignHook('onBeforeInit'),
        onAfterInit: assignHook('onAfterInit'),
        onDone: assignHook('onDone')
    };
})(window.document, window.performance);
