# Base Templates

Seeing how multiple templates are sharing quite a few commonalities, the need to be able to define a base template arose.
The implemented solution introduces the concept of slots that you define within these templates. Derived templates will use slots as placeholders for their elements.

* A derived template will only contain fragments and tags. These elements will be used to populate the base template.
* You can assign any number of elements to a slot.
* If a tag is not valid at the position of the slot then it will be appended to the body of the base template. For example, a div tag is not valid in the head.
* If you need to place your fragment in a slot inside the head, you will need to define it
like this `<script type="fragment" slot="custom-slot-name" primary ...></script>`.
* All fragments and tags that are not assigned to a slot will be appended to the body of the base template.

*base-template.html*
```html
<!doctype html>
<html>
<head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="dns-prefetch" href="https://example.com" />
    <script type="slot" name="head"></script>
</head>
<body>
    <slot name="body-start"></slot>
    <div>Hello</div>
</body>
</html>
```

*example-page.html*

```html
<meta slot="head" charset="utf-8">
<script slot="body-start" src="http://blah"></script>
<fragment src="http://localhost" async primary ></fragment>
<title slot="head">Test Template</title>
```

The rendered html output will look like this
```html
<!doctype html>
<html>
<head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="dns-prefetch" href="https://example.com" />
    <meta charset="utf-8">
    <title>Test Template</title>
</head>
<body>
    <script src="http://blah"></script>
    <div>Hello</div>
    <fragment src="http://localhost" async primary ></fragment>
</body>
</html>
```
