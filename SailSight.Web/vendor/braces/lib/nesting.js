'use strict';

const MAX_NESTING = 128;

const assertNesting = depth => {
  if (depth > MAX_NESTING) {
    throw new SyntaxError(`Brace pattern exceeds maximum nesting depth (${MAX_NESTING})`);
  }
};

// Walk only child edges: upstream ASTs have intentional parent/prev back-links.
// An iterative traversal also protects callers that provide their own AST.
const assertAstNesting = ast => {
  const active = new Set();
  const stack = [{ node: ast, depth: ast.type === 'root' ? 0 : 1, exit: false }];
  while (stack.length > 0) {
    const { node, depth, exit } = stack.pop();
    if (exit) {
      active.delete(node);
      continue;
    }
    if (!node.nodes) continue;
    assertNesting(depth);
    if (active.has(node)) throw new SyntaxError('Brace AST contains a child cycle');
    active.add(node);
    stack.push({ node, depth, exit: true });
    for (let index = node.nodes.length - 1; index >= 0; index--) {
      stack.push({ node: node.nodes[index], depth: depth + 1, exit: false });
    }
  }
};

module.exports = { assertNesting, assertAstNesting };
