var Pipe = (function (doc, perf) { //eslint-disable-line no-unused-vars, strict
    return function (require) {
        var placeholders = {};
        var starts = {};
        var scripts = doc.getElementsByTagName('script');
        // Fragments that decide the interactive time of main content on the page
        var mainFragments = Object.create(null);
        var isInteractiveDone = false;
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
        function placeholder (index) {
            placeholders[index] = currentScript();
        }
        function start (index, script, isMainFragment) {
            starts[index] = currentScript();
            if (script) {
                // Main Fragments helps in deciding the interactivity of the page
                // Primary fragments by default are considered to be main
                if (isMainFragment) {
                    mainFragments[index] = {
                        initialized: false
                    };
                }
                require([script]);
            }
        }
        function end (index, script, fragmentId) {
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
                // check if User Timing API is supported
                var isUTSupported = perf && 'mark' in perf;

                function isPromise(obj) {
                    return typeof obj === 'object'
                        && typeof obj.then === 'function';
                }

                function measureInitCost(metricName) {
                    if (!isUTSupported) {
                        return;
                    }
                    perf.mark(fragmentId);
                    return function () {
                        perf.mark(fragmentId + '-end');
                        perf.measure(metricName + fragmentId, fragmentId, fragmentId + '-end');
                        // Clear the perf entries buffer after measuring
                        perf.clearMarks(fragmentId);
                        perf.clearMarks(fragmentId + '-end');
                    };
                }

                function isMainContentInteractive() {
                    for (var index in mainFragments) {
                        var obj = mainFragments[index];
                        if (!obj.initialized) {
                            return false;
                        }
                    }
                    return true;
                }

                function captureInteractivity() {
                    // Handle if there are no main fragments on the page
                    if (JSON.stringify(mainFragments) === '{}') {
                        isInteractiveDone = true;
                        return;
                    }

                    if (isMainContentInteractive()) {
                        isInteractiveDone = true;
                        // This will measure the high resolution time from navigationStart till current time
                        perf.measure('interactive');
                    }
                }

                function markInitialized() {
                    if (typeof mainFragments[index] === 'object') {
                        mainFragments[index].initialized = true;
                    }
                }

                function doInit(init, node, callback) {
                    var fragmentRender = init(node);
                    var handlerFn = function() {
                        markInitialized();
                        callback();
                    };
                    // Check if the response from fragment is a Promise to allow lazy rendering
                    if (isPromise(fragmentRender)) {
                        fragmentRender.then(handlerFn, handlerFn);
                    } else {
                        handlerFn();
                    }
                }

                // Capture initializaion cost of each fragment on the page using User Timing API if available
                doInit(init, node, measureInitCost('fragment-'));
                // Capture the interactivity once all the main fragments are initialized
                if (!isInteractiveDone) {
                    captureInteractivity();
                }
            });
        }
        /* @preserve - loadCSS: load a CSS file asynchronously. [c]2016 @scottjehl, Filament Group, Inc. Licensed MIT */
        function loadCSS (href) {
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
        return {
            placeholder: placeholder,
            start: start,
            end: end,
            loadCSS: loadCSS
        };
    };
})(window.document, window.performance);
