(function(doc, perf, IntersectionObserver, IntersectionObserverEntry) { //eslint-disable-line no-unused-vars, strict, prettier/prettier
    var placeholders = {};
    var starts = {};
    var scripts = doc.getElementsByTagName('script');
    // State to maintain if all fragments on the page are initialized
    var initState = [];
    // custom performance entries that are reported from fragments
    var entries = [];
    var noop = function() {};
    // Hooks that will be replaced later on the page
    var hooks = {
        onStart: noop,
        onBeforeInit: noop,
        onAfterInit: noop,
        onDone: noop
    };

    function currentScript() {
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

    function start(index, script, attributes) {
        console.log('>>>>>>>> start script: ', script);
        starts[index] = currentScript();
        if (script && !attributes.lazyjs) {
            initState.push(index);
            hooks.onStart(attributes, index);
            require([script]);
        }
    }

    // OnDone will be called once the document is completed parsed and there are no other fragments getting streamed.
    function fireDone() {
        if (
            initState.length === 0 &&
            doc.readyState &&
            (doc.readyState === 'complete' || doc.readyState === 'interactive')
        ) {
            hooks.onDone();
        }
    }

    function isPromise(obj) {
        return typeof obj === 'object' && typeof obj.then === 'function';
    }

    function doInit(init, node, attributes, index) {
        hooks.onBeforeInit(attributes, index);
        var fragmentRendering = init(node);
        var handlerFn = function() {
            initState.pop();
            hooks.onAfterInit(attributes, index);
            fireDone(attributes);
        };
        // Check if the response from fragment is a Promise to allow lazy rendering
        if (isPromise(fragmentRendering)) {
            fragmentRendering.then(handlerFn).catch(handlerFn);
        } else {
            handlerFn();
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

        if (!attributes.lazyjs) {
            console.log('>>>>>>>> execute script immediately');
            script &&
                require([script], function(i) {
                    // Exported AMD fragment initialization Function/Promise
                    var init = i && i.__esModule ? i.default : i;
                    // early return & calling hooks for performance measurements
                    if (typeof init !== 'function') {
                        initState.pop();
                        hooks.onBeforeInit(attributes, index);
                        hooks.onAfterInit(attributes, index);
                        fireDone();
                        return;
                    }
                    // Initialize the fragment on the DOM node
                    doInit(init, node, attributes, index);
                });
        } else {
            console.log('>>>>>>>> execute script later using IntersectionObserver');
            observeNodeVisibility(script, node, attributes, index);
        }
    }

    /**
     * Observe the visibility of node in viewport
     * @param {String} nodeId id of a container
     */
    function observeNodeVisibility(script, node, attributes, index) {
        if (node) {
            if (
                IntersectionObserver &&
                IntersectionObserverEntry &&
                'intersectionRatio' in IntersectionObserverEntry.prototype
            ) {
                var options = {
                    root: null, // browser viewport
                    threshold: [0, 0.25, 0.5, 0.75, 1] // callback run every time visibility passes another 25%
                };
                var callback = function(entries, observer) {
                    entries.forEach(function(entry) {
                        if (entry.intersectionRatio > 0) {
                            // load javascript asynchronously
                            loadJS(script, node, attributes, index);
                            // Unobserve target
                            observer.unobserve(entry.target);
                        }
                    });
                };
                var observer = new IntersectionObserver(callback, options);
                observer.observe(node);
            } else {
                // load javascript right away
                loadJS(script, node, attributes, index);
            }
        }
    }

    /**
     * Load a js file asynchronously
     * @param {String} script
     */
    function loadJS(script, node, attributes, index) {
        script &&
            require([script], function(i) {
                // Exported AMD fragment initialization Function/Promise
                var init = i && i.__esModule ? i.default : i;
                // early return & calling hooks for performance measurements
                if (typeof init !== 'function') {
                    initState.pop();
                    hooks.onBeforeInit(attributes, index);
                    hooks.onAfterInit(attributes, index);
                    fireDone();
                    return;
                }
                // Initialize the fragment on the DOM node
                doInit(init, node, attributes, index);
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
        function ready(cb) {
            if (doc.body) {
                return cb();
            }
            setTimeout(function() {
                ready(cb);
            });
        }
        // Inject link
        // Note: `insertBefore` is used instead of `appendChild`, for safety re: http://www.paulirish.com/2011/surefire-dom-element-insertion/
        ready(function() {
            ref.parentNode.insertBefore(ss, ref.nextSibling);
        });
        // A method (exposed on return object for external use) that mimics onload by polling until document.styleSheets until it includes the new sheet.
        var onloadcssdefined = function(cb) {
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
                ss.removeEventListener('load', loadCB);
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
    /*
    * Custom Performance entries that can be added from fragments
    * It's needed because browsers currently do not expose an API to add
    * custom timing information to performance entries
    */
    function addPerfEntry(name, duration) {
        // Should not add to entries when Navigation timing is not supported.
        if (!'timing' in perf) {
            return;
        }
        // duplicate entries are not handled to keep the API
        // similar to PerformanceEntry Object
        // https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEntry
        entries.push({
            name: name,
            duration: Number(duration),
            entryType: 'tailor',
            startTime: perf.now() || Date.now() - perf.timing.navigationStart
        });
    }
    // Unique API that allows fragments to specify the
    // time to first meaningul paint of the page
    function addTTFMPEntry(duration) {
        addPerfEntry('ttfmp', duration);
    }
    // Retrive the added entries from fragments for monitoring
    function getEntries() {
        return entries;
    }

    function assignHook(hookName) {
        return function(cb) {
            hooks[hookName] = cb;
        };
    }

    return {
        placeholder: placeholder,
        start: start,
        end: end,
        observeNodeVisibility: observeNodeVisibility,
        loadJS: loadJS,
        loadCSS: loadCSS,
        onStart: assignHook('onStart'),
        onBeforeInit: assignHook('onBeforeInit'),
        onAfterInit: assignHook('onAfterInit'),
        onDone: assignHook('onDone'),
        addPerfEntry: addPerfEntry,
        addTTFMPEntry: addTTFMPEntry,
        getEntries: getEntries
    };
})(
    window.document,
    window.performance,
    window.IntersectionObserver,
    window.IntersectionObserverEntry
);
