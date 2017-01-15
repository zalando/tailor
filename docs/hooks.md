# Front end Hooks

Tailor provides three hooks on the client side(Browser) that can be used for programmatically measuring Performance.

## API

### Pipe.onStart(callback(attributes))
+ callback will be called before every fragments gets inserted/piped in the browser.

### Pipe.onBeforeInit(callback(attributes))
+ callback will be called before every fragments on the page/template gets initialized.

### Pipe.onAfterInit(callback(attributes))
+ callback will be called after each fragments on the page gets initialized.

### Pipe.onDone(callback())
+ callback will be called when all the fragments on the page gets initialized.

## Options

#### attributes
+ The attributes that are available from hooks can be customized by overiding `pipeAttributes` function as part of Tailor options.
+ The default attributes that are available through hooks are `primary` and `id`.

Check out the [Performance](https://github.com/zalando/tailor/tree/master/docs/Performance.md) document on how to measure fragment initialzation time as well as capturing the time to interactivity of the page.
