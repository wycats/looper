(function(global) {

'use strict';

var looper = global.looper = {};

function define(name, options, prototype) {
  var providedConstructor = prototype.constructor;
  delete prototype.constructor;

  function Class() {
    options.extends.apply(this, arguments);
    if (providedConstructor) { providedConstructor.apply(this, arguments); }
  }

  var newPrototype = Class.prototype = Object.create(options.extends.prototype);

  for (var prop in prototype) {
    newPrototype[prop] = prototype[prop];
  }

  newPrototype.constructor = constructor;
  Class.toString = function() { return name; };

  return Class;
}

var Visitor = define('Visitor', { extends: Object }, {
  visit: function(node) {
    // elisions, uninitialized bindings, missing else clauses
    if (!node) { return; }

    if (!this.visitors[node.type]) { throw new Error("Could not find a visitor for " + node.type); }
    this.visitors[node.type].call(this, node, node['looper:scope']);
  },

  visitArray: function(array) {
    for (var i=0, l=array.length; i<l; i++) {
      this.visit(array[i]);
    }
  },

  binding: function(kind, name, isInitialized) {
    var currentScope = this.currentScope,
        scope = currentScope;

    if (kind === 'var') {
      // Find the nearest function scope
      while (scope.es6scope) {
        scope = scope.parent;
      }

      // If we're not in the top-level, initializing the
      // binding here is an unbound set
      if (scope !== currentScope && isInitialized) {
        currentScope.unboundSet(name);
      }
    }

    scope.bindings[name] = true;
  },

  unboundGet: function(name) {
    this.currentScope.unboundGet(name);
  },

  unboundSet: function(name) {
    this.currentScope.unboundSet(name);
  }
});

var Scope = define('Scope', { extends: Object }, {
  constructor: function(node, parent, es6scope) {
    this.node = node;
    this.parent = parent;
    this.es6scope = es6scope;

    if (parent) { parent.children.push(this); }

    this.unbound = { get: {}, set: {} };
    this.downstream = { get: {}, set: {} };
    this.bindings = {};
    this.children = [];

    node['looper:scope'] = this;
  },

  unboundGet: function(name) {
    this['unbound-get'] = true;
    this.unbound.get[name] = true;
  },

  unboundSet: function(name) {
    this['unbound-set'] = true;
    this.unbound.set[name] = true;
  }
});

function scope(node) {
  return node['looper:scope'];
}

function merge(a, b) {
  var merged = {}, prop;

  for (prop in a) {
    merged[prop] = a[prop];
  }

  for (prop in b) {
    merged[prop] = b[prop];
  }

  return merged;
}

function postprocess(scope) {
  var childBindings = { get: {}, set: {} }, propagate = { get: {}, set: {} };

  scope.children.forEach(function(s) {
    var sBindings = postprocess(s);
    childBindings.get = merge(childBindings.get, sBindings.get);
    childBindings.set = merge(childBindings.set, sBindings.set);
  });

  var prop;

  for (prop in childBindings.get) {
    scope.downstream.get[prop] = true;
    if (!scope.bindings[prop]) { propagate.get[prop] = true; }
  }

  for (prop in childBindings.set) {
    scope.downstream.set[prop] = true;
    if (!scope.bindings[prop]) { propagate.set[prop] = true; }
  }

  return { get: merge(propagate.get, scope.unbound.get), set: merge(propagate.set, scope.unbound.set) };
}

var ScopeAnalyzer = define('ScopeAnalyzer', { extends: Visitor }, {
  constructor: function(ast) {
    this.ast = ast;

    new Scope(ast);
  },

  analyze: function() {
    this.environment = {};
    this.visit(this.ast);

    postprocess(scope(this.ast));

    return this.ast;
  },

  scoped: function(node, callback, es6scope) {
    this.currentScope = new Scope(node, this.currentScope, es6scope);
    callback.call(this);
    this.currentScope = this.currentScope.parent;
  },

  visitors: {
    EmptyStatement: function() {
      // nothing to do
    },

    Program: function(program) {
      this.currentScope = scope(program);
      this.visitArray(program.body);
    },

    BlockStatement: function(block) {
      this.scoped(block, function() {
        this.visitArray(block.body);
      }, true);
    },

    IfStatement: function(statement) {
      this.visit(statement.test);

      var consequent = statement.consequent, alternate = statement.alternate;

      this.scoped(consequent, function() {
        this.visit(consequent);
      }, true);

      if (alternate) {
        this.scoped(alternate, function() {
          this.visit(alternate);
        }, true);
      }
    },

    SequenceExpression: function(sequence) {
      this.visitArray(sequence.expressions);
    },

    ExpressionStatement: function(statement) {
      this.visit(statement.expression);
    },

    ThisExpression: function(expression) {
      this.currentScope.this = true;
    },

    Literal: function() {
      // literals don't need to be tracked
    },

    BinaryExpression: function(binary) {
      this.visit(binary.left);
      this.visit(binary.right);
    },

    AssignmentExpression: function(expression) {
      var left = expression.left, right = expression.right;

      if (left.type === 'Identifier') {
        this.unboundSet(left.name);
      } else {
        this.visit(expression.left);
      }

      this.visit(expression.right);
    },

    Identifier: function(id) {
      // Only visit an identifier if it represents a bound get
      this.unboundGet(id.name);
    },

    ArrayExpression: function(expression) {
      this.visitArray(expression.elements);
    },

    ObjectExpression: function(expression) {
      this.visitArray(expression.properties);
    },

    Property: function(property) {
      this.visit(property.value);
    },

    FunctionExpression: function(expression) {
      // TODO
    },

    NewExpression: function(expression) {
      this.visitors.CallExpression.call(this, expression);
    },

    MemberExpression: function(expression) {
      var object = expression.object, property = expression.property;

      this.visit(expression.object);

      if (property.type !== 'Identifier' || expression.computed) {
        this.visit(property);
      }
    },

    CallExpression: function(expression) {
      var callee = expression.callee;

      this.visitArray(expression.arguments);
      this.visit(callee);
    },

    UpdateExpression: function(expression) {
      this.visit(expression.argument);
    },

    UnaryExpression: function(expression) {
      this.visit(expression.argument);
    },

    LogicalExpression: function(expression) {
      this.visit(expression.left);
      this.visit(expression.right);
    },

    ConditionalExpression: function(expression) {
      this.visit(expression.test);
      this.visit(expression.consequent);
      this.visit(expression.alternate);
    },

    VariableDeclaration: function(declaration) {
      var declarations = declaration.declarations;

      // copy var or let kind onto the child declarations
      declarations.forEach(function(decl) {
        decl.kind = declaration.kind;
      });

      this.visitArray(declarations);
    },

    VariableDeclarator: function(declarator) {
      var id = declarator.id, kind = declarator.kind, init = declarator.init;

      if (id.type === 'Identifier') {
        this.binding(kind, id.name, !!declarator.init);
      }

      this.visit(init);
    },

    FunctionDeclaration: function() {
      // TODO
    },

    DoWhileStatement: function(statement) {
      var test = statement.test, body = statement.body;

      this.visit(test);

      this.scoped(body, function() {
        this.visit(body);
      }, true);
    },

    WhileStatement: function(statement) {
      this.visitors.DoWhileStatement.call(this, statement);
    },

    ForStatement: function(statement) {
      this.visit(statement.init);
      this.visit(statement.update);

      this.visitors.DoWhileStatement.call(this, statement);
    }
  }
});

looper.ScopeAnalyzer = ScopeAnalyzer;

})(window);
