#!/usr/bin/env node
/**
 * Parser health — is every wired parser actually parsing an AST?
 *
 * Each parser falls back to regex when its backing library will not load. That fallback is
 * correct behaviour and the wrong thing to discover silently: regex output has the same
 * shape as AST output, just fewer and occasionally malformed symbols, so a broken native
 * addon looks like a slightly thinner graph rather than a failure.
 *
 * This runs in a fresh process, which the jest suite cannot: jest resets its module
 * registry between suites, and a native addon re-entered through a fresh registry can load
 * and accept setLanguage while returning a tree with no rootNode. That makes any in-jest
 * assertion about tree-sitter intermittent. This script is the authoritative check.
 *
 * Usage: node scripts/parser-health.js
 * Exit code 1 if a parser advertised as AST-backed is silently on its regex fallback.
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const P = (f) => require(path.join(ROOT, 'dist/cli/services/data/semantic-graph/parsers', f));

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', cyan: '\x1b[36m',
};

/**
 * Each case names what only a real parse can produce. The regex fallbacks genuinely fail
 * these: they read `from x import (` as a symbol named `(`, and keep only the first name
 * of a comma-separated import.
 */
const CASES = [
  {
    language: 'TypeScript/JavaScript',
    parser: () => new (P('typescript-parser.js').TypeScriptParser)(),
    file: 'article.controller.ts',
    source: [
      "import { Router } from 'express';",
      "const router = Router();",
      "router.get('/articles/:slug', async (req, res) => { res.end(); });",
      "export class ArticleService { async getArticles() { return []; } }",
    ].join('\n'),
    expect: (r) => {
      const fns = r.functions.map((f) => f.name);
      const classes = r.classes.map((k) => k.name);
      if (!classes.includes('ArticleService')) return 'class ArticleService not found';
      if (!fns.includes('get(/articles/:slug)')) return 'express route callback not named';
      if (!r.imports.some((i) => i.name === 'Router')) return 'import Router not found';
      return null;
    },
  },
  {
    language: 'Python',
    parser: () => new (P('tree-sitter-python-parser.js').TreeSitterPythonParser)(),
    file: 'views.py',
    source: [
      'from rest_framework import generics, mixins, status',
      'from .models import (',
      '    Article,',
      '    Comment,',
      ')',
      'class ArticleViewSet(viewsets.GenericViewSet):',
      '    def get_queryset(self):',
      '        return None',
    ].join('\n'),
    expect: (r) => {
      const names = r.imports.map((i) => i.name);
      for (const want of ['generics', 'mixins', 'status', 'Article', 'Comment']) {
        if (!names.includes(want)) return `import ${want} missing (regex fallback keeps only the first)`;
      }
      if (names.some((n) => !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(n))) {
        return `import name is not an identifier: ${names.filter((n) => !/^[A-Za-z_]/.test(n)).join(', ')}`;
      }
      if (!r.classes.some((k) => k.name === 'ArticleViewSet')) return 'class ArticleViewSet not found';
      return null;
    },
  },
  {
    language: 'Java',
    parser: () => new (P('tree-sitter-java-parser.js').TreeSitterJavaParser)(),
    file: 'ArticleService.java',
    source: [
      'package com.example.conduit;',
      'import java.util.List;',
      'public class ArticleService {',
      '    public List<String> getArticles() { return null; }',
      '}',
    ].join('\n'),
    expect: (r) => {
      const cls = r.classes.find((k) => k.name === 'ArticleService');
      if (!cls) return 'class ArticleService not found';
      if (!cls.methods.includes('getArticles')) return 'method getArticles not found';
      if (!r.imports.some((i) => i.name === 'List' && i.from === 'java.util.List')) {
        return 'import java.util.List not found';
      }
      return null;
    },
  },
];

(async () => {
  console.log(`\n${c.bold}${c.cyan}━━━ parser health ━━━${c.reset}\n`);
  let failures = 0;

  for (const testCase of CASES) {
    const parser = testCase.parser();
    let astState = 'n/a';
    if (typeof parser.usingAst === 'function') {
      astState = (await parser.usingAst()) ? 'AST' : 'REGEX FALLBACK';
    }

    const parsed = await parser.parse(testCase.source, testCase.file);
    const problem = testCase.expect(parsed);
    const parseFailure = typeof parser.lastAstParseFailure === 'function'
      ? parser.lastAstParseFailure()
      : null;

    if (problem || parseFailure) {
      failures++;
      console.log(`  ${c.red}FAIL${c.reset} ${c.bold}${testCase.language}${c.reset}  [${astState}]`);
      if (problem) console.log(`       ${problem}`);
      if (parseFailure) console.log(`       parse threw: ${parseFailure}`);
      if (typeof parser.astUnavailableReason === 'function') {
        const why = await parser.astUnavailableReason();
        if (why) console.log(`       ${why}`);
      }
    } else {
      const counts = `${parsed.classes.length} classes, ${parsed.functions.length} functions, ${parsed.imports.length} imports`;
      console.log(`  ${c.green}ok${c.reset}   ${c.bold}${testCase.language}${c.reset}  [${astState}]  ${c.dim}${counts}${c.reset}`);
    }
  }

  console.log('');
  if (failures > 0) {
    console.log(`${c.red}${failures} parser(s) are not delivering the extraction they advertise.${c.reset}\n`);
    process.exit(1);
  }
  console.log(`${c.green}All wired parsers are producing real ASTs.${c.reset}\n`);
  process.exit(0);
})().catch((e) => {
  console.error('fatal:', e.message);
  process.exit(1);
});
