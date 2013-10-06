Looper is a project that provides tools for analyzing ES6 code in an
effort to make transpiled output smaller and more efficient.

## Scope Analyzer

The first part of Looper is the Scope Analyzer. The goal of the scope
anlayzer is to preprocess an AST and tag nodes with additional
information about the scopes they represent.

For example, consider this code:

```js
{
  let { x, y } = a.b;

  if (x) {
    _ref = x._ref;
  }
}
```

In this case, there are three scopes:

* The top-level scope, which contains one Block, no bindings, one
  downstream binding mutation (`_ref`), and no downstream usages of
  direct `eval`.
* The Block, which contains two bindings (`x` and `y`), one
  upstream binding reference (`a`), one downstream binding reference
  (`x`), one downstream binding mutation (`ref`) and no downstream
  usages of direct `eval`.
* The Block inside the IfStatement, which contains one upstream binding
  mutation (`_ref`), one upstream binding reference (`x`) and no
  downstream usages of direct `eval`.

This information can be used when transpiling the destructuring
assignment. In particular, this destructuring assignment needs to assign
`a.b` to a temporary variable.

Because we know that `x` and `_ref` are used downstream, we should
**not** use those names for our temporary variable.

We could transpile the destructuring assignment to something like this
reliably (the `let` would be transpiled separately, using similar
information to keep it reliable and small):

```js
{
  // since we know that t is never used downstream, we can be sure that
  let t = a.b, x = t.x, y = t.y;

  if (x) {
    _ref = x._ref;
  }
}
```

Let's look at a similar example with just `let`:


```js
function log(string) {
  if (string) {
    let string = `${string}!`;
    console.log(string);
  } else {
    let string = "No string provided to log";
    console.warn(string);
  }
}
```

In this case, the `let` variables inside the blocks can be reliably
converted into `vars` since they are not used in another child scope of
the containing function scope.

In this case, when transpiling the `let`, we would go up to the function
scope, and check to see whether there are direct child scopes (other
than the conditional's scopes) that reference or mutate the `string`
binding. If not, we are safe to just transpile the `let` directly into a
`var`.

By tracking all downstream variable references and mutations in a single
pass, we can avoid having to constantly do arbitrary-depth tree-walks
during the transpilation itself.

### Scope Annotations

(NOTE: This section is slightly ahead of the implementation; that will
be corrected soon)

Every node that represents a new scope is annotated with a
`looper:scope` property that is a Scope object.

The scope has a number of useful properties on it:

* `node`: the node the scope represents
* `parent`: the parent scope of this scope
* `children`: a list of child scopes of this scope
* `es6scope`: if this is true, the scope represents a `let` 
  scope. If false, it represents a function scope.
* `upstream`: An object with two properties, `get` and `set`.
  * `get` is a Set of bindings that this scope references
    that are not declared on this scope.
  * `set` is a Set of bindings that this scope mutates
    that are not declarared on this scope.
* `downstream`: An object with two properties, `get` and
  `set` that represents the union of all `upstream` properties
  on downstream scopes.
* `unbound`: An object with two properties, `get` and `set`.
  * `get` is a list of all binding references that escape the
    current scope.
  * `set` is a list of all binding mutations that escape the
    current scope.
* `bindings`: a Set of bindings declared on this scope. Note
  that `var` bindings are always considered declared on their
  function scope. If initialized, they are considered unbound
  mutations.

Note that it's possible to get a list of all "global" references
and mutations from a program by unioning the `get` and `set`
properties of the Program Scope's `unbound` property.

It also has some useful methods.

* `parentFunctionScope`: the closest parent scope that is a
  function scope, rather than an ES6 Block scope.
