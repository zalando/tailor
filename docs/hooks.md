# Front end Hooks

Tailor provides four hooks on the client side(Browser) that can be used for programmatically measuring Performance.

## API

### Pipe.onStart(callback(attributes, index))
+ callback will be called before every script from fragments gets inserted/piped in the browser.

### Pipe.onBeforeInit(callback(attributes, index))
+ callback will be called before each script from fragments on the page/template gets initialized.

### Pipe.onAfterInit(callback(attributes, index))
+ callback will be called after each script from fragments on the page gets initialized.

### Pipe.onDone(callback())
+ callback will be called when all the fragment scripts on the page gets initialized.

## Options

#### attributes
+ The attributes that are available from hooks can be customized by overiding `pipeAttributes` function as part of Tailor options.
+ The default attributes that are available through hooks are `primary` and `id`.

#### index
+ The order in which the script tags(sent via `Link Headers` from each fragment) are flushed to the browser

**NOTE: Hooks wont work properly for scripts/modules that are not AMD**

Check out the [Performance](https://github.com/zalando/tailor/tree/master/docs/Performance.md) document on how to measure fragment initialzation time as well as capturing the time to interactivity of the page.
