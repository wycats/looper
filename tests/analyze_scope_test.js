(function() {

'use strict';

var ast;

function analyze(source, callback) {
  test(source, function() {
    ast = esprima.parse(source);
    new looper.ScopeAnalyzer(ast).analyze();
    if (callback) {
      callback(ast);
    }
  });
}

var flags = ['this', 'unbound-set'];

function assertFlags(passedAst, expectedFlags) {
  if (arguments.length < 2) {
    expectedFlags = passedAst;
    passedAst = ast;
  }

  delete assertions.flags;

  var scope = passedAst['looper:scope'];

  for (var i=0, l=flags.length; i<l; i++) {
    var flag = flags[i];
    if (expectedFlags.indexOf(flag) !== -1) {
      QUnit.push(scope[flag], scope[flag], true, "The node should have the '" + flag + "' flag");
    } else {
      QUnit.push(!scope[flag], scope[flag], false, "The node should not have the '" + flag + "' flag");
    }
  }
}

function assertUnbound(passedAst, get, set) {
  if (arguments.length < 3 && (!passedAst || !passedAst.type)) {
    set = get;
    get = passedAst;
    passedAst = ast;
  }

  delete assertions.unbound;

  var unbound = { get: {}, set: {} };

  if (get) get.forEach(function(prop) { unbound.get[prop] = true; });
  if (set) set.forEach(function(prop) { unbound.set[prop] = true; });

  QUnit.push(QUnit.equiv(passedAst['looper:scope'].unbound, unbound), ast['looper:scope'].unbound, unbound, "Unbound variables are identified correctly");
}

function assertBound(passedAst, bindingList) {
  if (arguments.length < 2) {
    bindingList = passedAst;
    passedAst = ast;
  }

  delete assertions.bindings;

  var bindings = {};

  bindingList.forEach(function(prop) { bindings[prop] = true; });

  QUnit.push(QUnit.equiv(passedAst['looper:scope'].bindings, bindings), ast['looper:scope'].bindings, bindings, "Bindings are identified correctly");
}

function assertDownstream(passedAst, get, set) {
  if (arguments.length < 3 && (!passedAst || !passedAst.type)) {
    set = get;
    get = passedAst;
    passedAst = ast;
  }

  var scope = passedAst['looper:scope'];

  delete assertions.downstream;

  var downstream = { get: {}, set: {} };

  if (get) get.forEach(function(prop) { downstream.get[prop] = true; });
  if (set) set.forEach(function(prop) { downstream.set[prop] = true; });

  QUnit.push(QUnit.equiv(passedAst['looper:scope'].downstream, downstream), ast['looper:scope'].downstream, downstream, "Downstream variables are identified correctly");
}

var assertions;

function syntax(title) {
  module(title, {
    setup: function() {
      assertions = { flags: true, unbound: true, downstream: true };
      ast = null;
    },
    teardown: function() {
      Object.keys(assertions).forEach(function(assertion) {
        switch(assertion) {
          case 'flags':
            return assertFlags(ast, []);
          case 'unbound':
            return assertUnbound(ast, [], []);
          case 'downstream':
            return assertDownstream(ast, [], []);
        }
      });
    }
  });
}

syntax('Primary Expression');

analyze('this', function(ast) {
  assertFlags(ast, ['this']);
});

analyze('null');
analyze('\n    42\n\n');
analyze('(1 + 2 ) * 3');

syntax('Empty Statement');

analyze(';');

syntax('Grouping Operator');

analyze('(1) + (2  ) + 3');
analyze('4 + 5 << (6)');

syntax('Array Initializer');

analyze('x = []', function(ast) {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x = [ 42 ]', function(ast) {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x = [ 42, ]', function(ast) {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x = [ ,, 42 ]', function(ast) {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x = [ 1, 2, 3, ]', function(ast) {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x = [ 1, 2,, 3, ]', function(ast) {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x = [ "finally", "for" ]', function(ast) {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('T\u203f = []', function(ast) {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['T\u203f']);
});

analyze('T\u200C = []', function(ast) {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['T\u200C']);
});

analyze('T\u200D = []', function(ast) {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['T\u200D']);
});

analyze('\u2164\u2161 = []', function(ast) {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['\u2164\u2161']);
});

analyze('[",", "second"]');

syntax('Object Initializer');

analyze('x = {}', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x = { answer: 42 }', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x = { get width() { return m_width; } }', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x = { set width(w) { m_width = w; } }', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

syntax('Numeric Literals');

analyze('0');
analyze('.14');
analyze('6.02214179e+23');

syntax('String Literals');

analyze('"Hello"');

syntax('Regular Expression Literals');

analyze('(/[a-z]/i)');

syntax('Left-Hand-Side Expression');

analyze('new Button', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['Button']);
});

analyze('new new foo', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['foo']);
});

analyze('new foo().bar()', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['foo']);
});

analyze('new foo[bar]', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['foo', 'bar']);
});

analyze('new foo.bar()', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['foo']);
});

analyze('(new foo).bar()', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['foo']);
});

analyze('foo(bar, baz)', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['foo', 'bar', 'baz']);
});

analyze('(foo)()', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['foo']);
});

analyze('universe.milkyway', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['universe']);
});

analyze('universe.milkyway.solarsystem', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['universe']);
});

analyze('universe[galaxyName, otherUselessName]', function(ast) {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['universe', 'galaxyName', 'otherUselessName']);
});

analyze('universe[galaxyName]', function(ast) {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['universe', 'galaxyName']);
});

analyze('universe[42].galaxies', function(ast) {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['universe']);
});

analyze('universe(42).galaxies', function(ast) {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['universe']);
});

analyze('universe(42).galaxies(14, 3, 77).milkyway', function(ast) {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['universe']);
});

analyze('earth.asia.Indonesia.prepareForElection(2014)', function(ast) {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['earth']);
});

syntax('Postfix Expressions');

analyze('x++', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

analyze('x--', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

analyze('(x.y)--', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

syntax('Unary Operators');

analyze('++x', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

analyze('--x', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

analyze('+x', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

analyze('-x', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

analyze('~x', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

analyze('!x', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

analyze('void x', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

analyze('delete x', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

analyze('typeof x', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x']);
});

syntax('Multiplicative Operators');

analyze('x * y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x / y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x % y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

syntax('Additive Operators');

analyze('x + y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x - y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

syntax('Bitwise Shift Operators');

analyze('x >> y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x << y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x >>> y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

syntax('Relational Operators');

analyze('x > y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x < y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x >= y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x <= y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x in y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x instanceof y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x < y < z', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y', 'z']);
});

syntax('Equality Operators');

analyze('x == y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x === y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x != y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x !== y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

syntax('Binary Bitwise Operators');

analyze('x & y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x ^ y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x | y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

syntax('Binary Expressions');

analyze('x + y + z', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y', 'z']);
});

analyze('x - y + z', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y', 'z']);
});

analyze('x + y - z', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y', 'z']);
});

analyze('x - y - z', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y', 'z']);
});

analyze('x + y * z', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y', 'z']);
});

analyze('x + y / z', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y', 'z']);
});

analyze('x + y % z', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y', 'z']);
});

syntax('Binary Logical Operators');

analyze('x || y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x && y', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

analyze('x || y || z', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y', 'z']);
});

analyze('x && y && z', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y', 'z']);
});

syntax('Conditional Operators');

analyze('x ? y : z', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y', 'z']);
});

analyze('x && y ? 1 : 2', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['x', 'y']);
});

syntax('Assignment Operators');

analyze('x = 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x *= 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x /= 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x %= 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x += 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x -= 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x <<= 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x >>= 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x >>>= 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x &= 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x |= 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

analyze('x ^= 42', function() {
  assertFlags(ast, ['unbound-set']);
  assertUnbound(null, ['x']);
});

syntax('Complex Expressions');

analyze('a || b && c | d ^ e & f == g < h >>> i + j * k', function() {
  assertFlags(ast, ['unbound-get']);
  assertUnbound(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']);
});

syntax('Block');

analyze('{ foo }', function() {
  assertFlags([]);
  assertUnbound([]);
  assertDownstream(['foo']);

  assertFlags(ast.body[0], ['unbound-get']);
  assertUnbound(ast.body[0], ['foo']);
});

analyze('{ { foo } }', function() {
  assertFlags([]);
  assertUnbound([]);
  assertDownstream(['foo']);

  assertFlags(ast.body[0], []);
  assertUnbound(ast.body[0], []);
  assertDownstream(ast.body[0], ['foo']);

  assertFlags(ast.body[0].body[0], ['unbound-get']);
  assertUnbound(ast.body[0].body[0], ['foo']);
});

analyze('{}');

syntax('Variable Statement');

analyze('var x', function() {
  assertFlags(['binding']);
  assertBound(['x']);
});

analyze('{ var x }', function() {
  assertFlags(['binding']);
  assertBound(['x']);

  assertFlags(ast.body[0], []);
  assertBound(ast.body[0], []);
});

analyze('var x, y', function() {
  assertFlags(['binding']);
  assertBound(['x', 'y']);
});

analyze('{ var x, y }', function() {
  assertFlags(['binding']);
  assertBound(['x', 'y']);

  assertFlags(ast.body[0], []);
  assertBound(ast.body[0], []);
});

analyze('var x = 42', function() {
  assertFlags(['binding']);
  assertBound(['x']);
});

analyze('{ var x = 42 }', function() {
  assertFlags(['binding']);
  assertBound(['x']);
  assertDownstream(null, ['x']);

  assertFlags(ast.body[0], ['unbound-set']);
  assertUnbound(ast.body[0], null, ['x']);
  assertBound(ast.body[0], []);
});

analyze('var x = 42, y = 3, z = 1977', function() {
  assertFlags(['binding']);
  assertBound(['x', 'y', 'z']);
});

analyze('{ var x = 42, y = 3, z = 1977 }', function() {
  assertFlags(['binding']);
  assertBound(['x', 'y', 'z']);
  assertDownstream(null, ['x', 'y', 'z']);

  assertFlags(ast.body[0], ['unbound-set']);
  assertUnbound(ast.body[0], null, ['x', 'y', 'z']);
});

syntax('Let Statement');

analyze('let x', function() {
  assertFlags(['binding']);
  assertBound(['x']);
});

analyze('{ let x }', function() {
  assertFlags(ast.body[0], ['binding']);
  assertBound(ast.body[0], ['x']);
});

analyze('let x, y', function() {
  assertFlags(['binding']);
  assertBound(['x', 'y']);
});

analyze('{ let x, y }', function() {
  assertFlags(ast.body[0], ['binding']);
  assertBound(ast.body[0], ['x', 'y']);
});

analyze('let x = 42', function() {
  assertFlags(['binding']);
  assertBound(['x']);
});

analyze('{ let x = 42 }', function() {
  assertFlags(ast.body[0], ['binding']);
  assertBound(ast.body[0], ['x']);
});

analyze('let x = 42, y = 3, z = 1977', function() {
  assertFlags(['binding']);
  assertBound(['x', 'y', 'z']);
});

analyze('{ let x = 42, y = 3, z = 1977 }', function() {
  assertFlags(ast.body[0], ['binding']);
  assertBound(ast.body[0], ['x', 'y', 'z']);
});

syntax('Const Statement');

analyze('const x = 42', function() {
  assertFlags(['binding']);
  assertBound(['x']);
});

analyze('{ const x = 42 }', function() {
  assertFlags(ast.body[0], ['binding']);
  assertBound(ast.body[0], ['x']);
});

analyze('const x = 42, y = 3, z = 1977', function() {
  assertFlags(['binding']);
  assertBound(['x', 'y', 'z']);
});

analyze('{ const x = 42, y = 3, z = 1977 }', function() {
  assertFlags(ast.body[0], ['binding']);
  assertBound(ast.body[0], ['x', 'y', 'z']);
});

syntax("Expression Statement");

analyze('x', function() {
  assertFlags(['unbound-get']);
  assertUnbound(['x']);
});

analyze('x, y', function() {
  assertFlags(['unbound-get']);
  assertUnbound(['x', 'y']);
});

syntax('If Statement');

analyze('if (morning) goodMorning()', function() {
  assertFlags(['unbound-get']);
  assertUnbound(['morning']);
  assertDownstream(['goodMorning']);

  assertFlags(ast.body[0].consequent, ['unbound-get']);
  assertUnbound(ast.body[0].consequent, ['goodMorning']);
});

analyze('if (morning) (function() {})', function() {
  assertFlags(['unbound-get']);
  assertUnbound(['morning']);
});

analyze('if (morning) var x = 0', function() {
  assertFlags(['binding']);
  assertUnbound(['morning']);
  assertDownstream(null, ['x']);
  assertBound(['x']);

  assertFlags(ast.body[0].consequent, ['unbound-set']);
  assertUnbound(ast.body[0].consequent, null, ['x']);
});

analyze('if (morning) function a() {}', function() {
  assertFlags(['binding']);
  assertUnbound(['morning']);

  // TODO: Strict and unstrict semantics for where a goes
});

analyze('if (morning) goodMorning(); else goodDay()', function() {
  assertFlags(['unbound-get']);
  assertUnbound(['morning']);
  assertDownstream(['goodMorning', 'goodDay']);
});

syntax('Iteration Statements');

analyze('do keep(); while (true)', function() {
  assertDownstream(['keep']);

  assertFlags(ast.body[0].body, ['unbound-get']);
  assertUnbound(ast.body[0].body, ['keep']);
});

analyze('do { x++; y-- } while (x < 10)', function() {
  assertFlags(['unbound-get']);
  assertUnbound(['x']);
  assertDownstream(['x', 'y']);

  assertFlags(ast.body[0].body, ['unbound-get']);
  assertUnbound(ast.body[0].body, ['x', 'y']);
});

analyze('{ do { } while(false) false }', function() {
  assertFlags(ast.body[0], []);
  assertUnbound(ast.body[0], [], []);
  assertBound(ast.body[0], []);
});

analyze('while (true) doSomething()', function() {
  assertDownstream(['doSomething']);

  assertFlags(ast.body[0].body, ['unbound-get']);
  assertUnbound(ast.body[0].body, ['doSomething']);
});

analyze('while (x < 10) { x++; y--; }', function() {
  assertFlags(['unbound-get']);
  assertUnbound(['x']);
  assertDownstream(['x', 'y']);

  assertFlags(ast.body[0].body, ['unbound-get']);
  assertUnbound(ast.body[0].body, ['x', 'y']);
});

analyze('for(;;);', function() {
  assertFlags(ast.body[0].body, []);
  assertUnbound(ast.body[0].body, []);
});

analyze('for(x=0;;);', function() {
  assertFlags(['unbound-set']);
  assertUnbound(null, ['x']);

  assertFlags(ast.body[0].body, []);
  assertUnbound(ast.body[0].body, [], []);
});

analyze('for(let x = 0;;);', function() {
  // TODO: Scope of let here
});

})();
