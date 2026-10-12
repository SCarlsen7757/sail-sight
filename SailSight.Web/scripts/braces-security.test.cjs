const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { realpathSync } = require('node:fs');
const { test } = require('node:test');
const braces = require('../vendor/braces');

const isDepthError = error => error instanceof SyntaxError && /maximum nesting depth \(128\)/.test(error.message);
const nested = (open, close, depth) => open.repeat(depth) + 'a,b' + close.repeat(depth);

test('normal glob compilation and expansion retain upstream behavior', () => {
  assert.deepEqual(braces('src/{app,lib}/**/*.{ts,tsx}'), ['src/(app|lib)/**/*.(ts|tsx)']);
  assert.deepEqual(braces.expand('file-{1..3}.ts'), ['file-1.ts', 'file-2.ts', 'file-3.ts']);
  assert.deepEqual(braces.expand('{a,{b,c}}'), ['a', 'b', 'c']);
  assert.deepEqual(braces(['{a,b}', '{b,c}'], { expand: true, nodupes: true }), ['a', 'b', 'c']);
  assert.deepEqual(braces.expand('{a,,b}', { noempty: true }), ['a', 'b']);
  assert.deepEqual(braces.expand('unclosed/{a,b'), ['unclosed/{a,b']);
  assert.deepEqual(braces.expand('a}b'), ['a}b']);
  assert.equal(braces.stringify(braces.parse('a/{b,c}/d')), 'a/{b,c}/d');
});

test('escaped, quoted, and bracketed delimiters do not consume nesting depth', () => {
  const literal = '{'.repeat(256);
  assert.equal(braces.compile('\\{'.repeat(256)), literal);
  assert.equal(braces.compile('"' + literal + '"'), literal);
  assert.equal(braces.compile('[' + literal + ']'), '[' + literal + ']');
  assert.deepEqual(braces.expand('file-\\{literal\\}.ts'), ['file-{literal}.ts']);
});

test('128 nested blocks work; the 129th block fails deterministically', () => {
  for (const [open, close] of [['{', '}'], ['(', ')']]) {
    const valid = nested(open, close, 128);
    assert.doesNotThrow(() => braces.parse(valid));
    assert.doesNotThrow(() => braces.compile(valid));
    assert.doesNotThrow(() => braces.expand(valid));
    assert.doesNotThrow(() => braces.stringify(valid));
    assert.throws(() => braces.parse(nested(open, close, 129)), isDepthError);
  }
  assert.throws(() => braces.parse('{('.repeat(65) + 'a,b' + ')}'.repeat(65)), isDepthError);
});

test('all string entry points reject excessive nesting, including malformed input', () => {
  const inputs = [nested('{', '}', 4000), nested('(', ')', 4000), '{'.repeat(4000), '('.repeat(4000)];
  for (const input of inputs) {
    for (const operation of [braces, braces.create, braces.parse, braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => operation(input), isDepthError);
    }
  }
  assert.throws(() => braces.compile(nested('{', '}', 129), { maxDepth: Infinity }), isDepthError);
});

const makeAst = depth => {
  const ast = { type: 'root', nodes: [] };
  let parent = ast;
  for (let index = 0; index < depth; index++) {
    const node = { type: 'paren', nodes: [], parent };
    parent.nodes.push(node);
    parent = node;
  }
  parent.nodes.push({ type: 'text', value: 'x', parent });
  return ast;
};

test('externally supplied ASTs are bounded before recursive traversal', () => {
  for (const operation of [braces.compile, braces.expand, braces.stringify]) {
    assert.doesNotThrow(() => operation(makeAst(128)));
    assert.throws(() => operation(makeAst(129)), isDepthError);
    assert.throws(() => operation(makeAst(4000)), isDepthError);
    const cyclic = makeAst(1);
    cyclic.nodes[0].nodes.push(cyclic);
    assert.throws(() => operation(cyclic), /child cycle/);
  }
});

test('micromatch and the Next ESLint plugin resolve the patched sources', () => {
  const expected = realpathSync(require.resolve('../vendor/braces'));
  const micromatchRequire = createRequire(require.resolve('micromatch'));
  assert.equal(realpathSync(micromatchRequire.resolve('braces')), expected);
  const configRequire = createRequire(require.resolve('eslint-config-next'));
  const pluginRequire = createRequire(configRequire.resolve('@next/eslint-plugin-next'));
  const globRequire = createRequire(pluginRequire.resolve('fast-glob'));
  const globMicromatchRequire = createRequire(globRequire.resolve('micromatch'));
  assert.equal(realpathSync(globMicromatchRequire.resolve('braces')), expected);
  const micromatch = micromatchRequire('./');
  assert.deepEqual(micromatch(['src/app/page.tsx', 'src/lib/api.ts', 'src/other.txt'], 'src/{app,lib}/*.{ts,tsx}'),
    ['src/app/page.tsx', 'src/lib/api.ts']);
  assert.throws(() => micromatch.braces(nested('{', '}', 129)), isDepthError);
});

test('supplied AST parent cycles cannot hang expansion', () => {
  const ast = { type: 'paren', nodes: [] };
  ast.parent = ast;
  assert.throws(() => braces.expand(ast), isDepthError);
});
