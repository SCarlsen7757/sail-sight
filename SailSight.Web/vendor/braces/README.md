# SailSight's bounded braces fork

This is a private fork of [micromatch/braces 3.0.3](https://github.com/micromatch/braces/tree/3.0.3)
for [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), which has no published fix.
The original MIT license is retained in `LICENSE`.

Upstream npm archive: `https://registry.npmjs.org/braces/-/braces-3.0.3.tgz`.
Archive integrity: `sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==`.

The package is named `@sailsight/braces`, version `3.0.3-sailsight.1`; it does not
claim to be an upstream release. The root npm override resolves every `braces`
consumer to these checked-in sources. Its dependencies remain part of npm audit.

Changes from upstream:

- `lib/nesting.js` implements a fixed depth limit of 128 and an iterative AST
  validation pass that detects child cycles without traversing parent back-links.
- `lib/parse.js` checks nesting before creating brace or parenthesis nodes,
  including malformed, unclosed input. Escaped/quoted characters stay literal.
- `compile`, `expand`, and `stringify` validate supplied ASTs before recursion.
- Expansion's parent-chain walks are also bounded, including supplied parent cycles.
- The package manifest identifies this private fork and retains `fill-range`.

Run `npm run test:security` from `SailSight.Web` for compatibility, exploit, and
consumer-resolution regression checks. CI runs this suite before linting/auditing.
Remove this fork and override once an upstream release fixes the advisory and
passes the same regressions. Do not replace it with an audit exception.
