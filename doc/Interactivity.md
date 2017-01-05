# Time to interactivity of Main Content

This doc is mostly inspired by [Time to interactive](https://docs.google.com/document/d/11sWqwdfd3u1TwyZhsc-fB2NcqMZ_59Kz4XKiivp1cIg/edit?pref=2&pli=1#) document.

Time to interactive of main content seeks to identify the time when the JavaScript from the main fragments of the page gets initialized(compiled + parsed + executed) and the page is visually ready or meaningful.

## What are main fragments

The fragments that are visible above the fold and which contains the critical content of the page.

*ProductPage.html*
```html
<!doctype html>
<html>
<head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta charset="utf-8">
</head>
<body>
    <fragment main id="header" src="header.zalando.de"/>
    <fragment main id="product-detail" src="product-detail.zalando.de" />
    <fragment id="recommendation" src="recos.zalando.de" />
    <fragment id="footer" src="footer.zalando.de" />
</body>
</html>
```

In the above product page, Header and Product detail fragment are marked as main fragments since these two fragments are enough for the page to provide the critical content to the user. Footer fragment here is below the fold and it is considered not critical.

**Note: The main fragments are maked by the teams that controls the given template/page**

## How it is measured

Time to interactivity of main content is marked when all the javascript assets from main fragments are initialized. It is the difference between the marked time and the browser's [navigation start](https://w3c.github.io/navigation-timing/#dom-performancetiming-navigationstart).

```js
//When all fragments are finished initializing
performance.measure('interactive'); // User Timing API

// Output
{
    duration: 564.7950000000001,
    entryType: "measure",
    name: "interactive",
    startTime: 0
}
```
[!Interactivity](/images/interactive-time.png)

## Requirements

#### Critical contents must be painted
+ All the fragments that are visible above the fold should be marked as main and must be painted.
+ If any of the main fragments is rendered lazily, then interactive time should take the lazy rendering in to account.

#### domContentLoaded has fired
+ It is fired when HTML parsing has finished.
+ In our case, the fragment assets are loaded asynchrounsly and hence the DCL is fired always before the interactivity.

## Caveats

#### Is the main thread available to handle the user input

The short answer is NO. Inorder to keep the main thread free, the fragments that are present below the fold, not visible (tracking), non critical should make sure thier initialization cost is <50-60ms.

We also measure the initialization cost of each fragment on the page, In the future we could also provide warnings/errors if they fall over the budget.

