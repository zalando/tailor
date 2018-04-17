# Basis-typescript

This example shows how to use Tailor with Typescript

## Run

Basically there 2 ways to use node with typescript.
In both cases types will be checked and from external point of view they should behave identically.

### With ts-node

Install ts-node and just run this file:

```bash
ts-node ./index.ts
```

### Transpile to javascript

Install TypeScript compiler and execute following;

```bash
tsk ./index.ts
# Now we have index.js and can run it with node.js
node ./index.js
```