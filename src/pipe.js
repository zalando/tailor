var Pipe = (function (doc, perf) { //eslint-disable-line no-unused-vars, strict
    return function (require) {
        var placeholders = {};
        var starts = {};
        var scripts = doc.getElementsByTagName('script');
        //
        var timingGroupsMap = Object.create(null);
        function getTimingGroups(attributes) {
            var timingGroups = attributes.timingGroups;
            // By default all the fragments are added to default timing group
            timingGroups.push('everything-init');
            if (attributes.primary) {
                timingGroups.push('primary-init');
            }
            return timingGroups;
        }
        function mapOver(arr, callback) {
            if (!arr) {
                return;
            }
            for (var i = 0; i < arr.length; i++) {
                callback(arr[i]);
            }
        }
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
        function start (index, script, attributes) {
            starts[index] = currentScript();
            if (script) {
                // Group the fragments that satisfies the same timing group
                var timingGroups = getTimingGroups(attributes);
                mapOver(timingGroups, function(groupName) {
                    if (!timingGroupsMap[groupName]) {
                        timingGroupsMap[groupName] = Object.create(null);;
                    }
                    timingGroupsMap[groupName][index] = {
                        initialized: false,
                    };
                });
                require([script]);
            }
        }
        function end (index, script, attributes) {
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

                // Measure initialization cost of each fragments on the page
                function measureInitCost(metricName) {
                    if (!isUTSupported) {
                        return;
                    }
                    var fragmentId = attributes.id ? attributes.id : index;
                    perf.mark(fragmentId);
                    return function () {
                        perf.mark(fragmentId + '-end');
                        perf.measure(metricName + fragmentId, fragmentId, fragmentId + '-end');
                        // Clear the perf entries buffer after measuring
                        perf.clearMarks(fragmentId);
                        perf.clearMarks(fragmentId + '-end');
                    };
                }

                function isTimingGroupInteractive(groupName) {
                    var fragments = timingGroupsMap[groupName];
                    for (var index in fragments) {
                        var obj = fragments[index];
                        if (!obj.initialized) {
                            return false;
                        }
                    }
                    return true;
                }

                function measureTimingGroup(timingGroups) {
                    mapOver(timingGroups, function(groupName) {
                        // Do not measure anything if the group is empty
                        if (!timingGroupsMap[groupName]) {
                            return;
                        }

                        if (isTimingGroupInteractive(groupName)) {
                            // This will measure the high resolution time from navigationStart till current time
                            perf.measure(groupName);
                        }
                    });
                }

                function markInitialized(timingGroups) {
                    mapOver(timingGroups, function(groupName) {
                        var fragments = timingGroupsMap[groupName];
                        if (typeof fragments[index] === 'object') {
                            fragments[index].initialized = true;
                        }
                    });
                }

                function doInit(init, node, callback) {
                    var fragmentRender = init(node);
                    // Determine the timing groups of the fragments
                    var timingGroups = getTimingGroups(attributes);
                    var handlerFn = function() {
                        markInitialized(timingGroups);
                        callback();
                        measureTimingGroup(timingGroups);
                    };
                    // Check if the response from fragment is a Promise to allow lazy rendering
                    if (isPromise(fragmentRender)) {
                        fragmentRender.then(handlerFn).catch(handlerFn);
                    } else {
                        handlerFn();
                    }
                }

                // Capture initializaion cost of each fragment on the page using User Timing API if available
                doInit(init, node, measureInitCost('fragment-'));
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
