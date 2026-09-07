/**
 * Conventional Commits, enforced at commit time.
 *
 * The commit type is not decoration: it is the parsing surface the document cascade
 * reads to decide which upper layer a change must amend. A `feat:` declares that the
 * change has specification implications; `fix:` declares that a regression test is owed.
 * See docs/adrs/ and .claude/adr/index.md.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // The default 100-char header is too tight for a descriptive subject.
    'header-max-length': [2, 'always', 120],
    // Body lines wrap at 100; commit bodies here carry real explanation.
    'body-max-line-length': [2, 'always', 100],
  },
};
