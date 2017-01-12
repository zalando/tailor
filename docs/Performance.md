# Performance

With the help of front end [hooks](https://github.com/zalando/tailor/tree/master/docs/Hooks.md), we can easily analayze the performance and report the data to our backend server for monitoring.

## Measuring fragment Initialization cost

By using the API hooks and with the help of User Timing API, We can easily measure the initialization time of all the fragments on the page.

*page.html*
```html
<!doctype html>
<html>
<head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta charset="utf-8">
    <script>
        // mark before the fragment Init Start
        Pipe.onBeforeInit(function(attributes) {
            var fragmentId = attributes.id;
            performance.mark(fragmentId);
        });
        // Mark the fragment after it is initialized
        Pipe.onAfterInit(function(attributes) {
            var fragmentId = attributes.id;
            performance.mark(fragmentId + 'end');
            // Measure the time difference between mark start and mark end to get the initialization cost
            performance.measure('fragment-' + fragmentId, fragmentId, fragmentId + 'end');
        });
    </script>
</head>
<body>
    <!-- Measure till till the header fragment is initialized -->
    <fragment id="header" src="http://header.zalando.de"/>
    <!-- Primary fragment -->
    <fragment primary id="product" src="http://product.zalando.de" />
    <fragment id="footer" src="http://footer.zalando.de" />
</body>
</html>
```

The metrics are shown visually on the Browser's timeline graph.

![Fragment Initialization](https://raw.githubusercontent.com/zalando/tailor/master/docs/images/fragment-init-cost.png)

We can collect the measured data using the Performance Timing API

```js
var data = performance.getEntriesByType('measure');
// Output
[
    {
        duration: 0.370,
        entryType: "measure",
        name: "fragment-header",
        startTime: 419.95
    },
    {
        duration: 0.609,
        entryType: "measure",
        name: "fragment-product",
        startTime: 435.02
    },
    {
        duration: 0.299,
        entryType: "measure",
        name: "fragment-footer",
        startTime: 437.99
    },
]
```

By using the above data, its easier to do keep budgets for each fragment and even plot real time graphs for analysing the performance over time.

## Measuring Time to interactive of critical content

The idea is heavily inspired by [Time to interactive](https://docs.google.com/document/d/11sWqwdfd3u1TwyZhsc-fB2NcqMZ_59Kz4XKiivp1cIg/edit?pref=2&pli=1#) document. The measurement is however not the real Time to interative explained in the document but instead can be used as a proxy.

In order to measure the interactivity of the critical content, we need to agree on a set/group of fragments that can decide the page interactivity and also help in measuring the time taken for the same.

### Definition

Time to interactive of critical content seeks to identify the time when the JavaScript from the critical fragments(group of fragments) of the page gets initialized(compiled + parsed + executed) and the page is visually ready or meaningful. It is the difference between the marked time and the browser's [navigation start](https://w3c.github.io/navigation-timing/#dom-performancetiming-navigationstart).

### Clustering fragments

To cluster the fragments, we are going to add a new attribute `timing-groups` to the fragments tag on the page.

**Note: Its totally possible to use different attribute name as well instead of timing-groups**

The interactivity of the example Productpage is decided by Header, Product and Footer fragments and above the fold time is decided by Header and Product fragment.

Now to measure the time, We are going to use the hooks that are provided by Tailor.

*ProductPage.html*
```html
<!doctype html>
<html>
<head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta charset="utf-8">
    <script>
        // Check the full implementation details in the example - https://github.com/zalando/tailor/tree/master/examples/fragment-performance/index.html
    </script>
</head>
<body>
    <fragment timing-groups="interactive, abovethefold" id="header" src="http://header.zalando.de"/>
    <fragment timing-groups="interactive, abovethefold" primary id="product" src="http://product.zalando.de" />
    <fragment timing-groups="reco-init" id="recos" src="http://recos.zalando.de" />
    <fragment timing-groups="interactive" id="footer" src="http://footer.zalando.de" />
</body>
</html>
```

![Interativity](https://raw.githubusercontent.com/zalando/tailor/master/docs/images/content-interactive.png)

Please use the drop in replacement script [here](https://github.com/zalando/tailor/tree/master/examples/fragment-performance/index.html) which measures both the fragment initialization as well the timing groups.

## Caveats

#### Is the main thread available to handle the user input

The short answer is NO. Inorder to keep the main thread free, the fragments that are present below the fold, not visible (tracking), non critical should make sure their initialization cost is <50-60ms.

We also measure the initialization cost of each fragment on the page, In the future we could also provide warnings/errors if they fall over the budget.

