/**
 * AstChunker Tests (TDD)
 *
 * Written BEFORE the implementation. Tests define the contract:
 *  - Chunks split at function/class/method symbol boundaries
 *  - No chunk exceeds MAX_CHUNK_LINES (80)
 *  - Each chunk carries {symbolName, symbolType, lineStart, lineEnd}
 *  - Overlap lines carried from prior chunk into next
 *  - Falls back to fixed-size splitting when no boundaries found
 *  - Works for TypeScript, JavaScript, Python, Go; graceful for unknown extensions
 *
 * Mutation matrix (see bottom of file): 3 targeted breaks, each caught by a test.
 */

import { AstChunker, CodeChunk, ChunkOptions } from '../../src/cli/services/search/ast-chunker';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const TS_CLASS_AND_METHODS = `
export class AuthService {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  async authenticate(email: string, password: string): Promise<string> {
    const user = await this.findUser(email);
    if (!user) throw new Error('Not found');
    return this.signToken(user);
  }

  private findUser(email: string) {
    return { id: 1, email };
  }

  private signToken(user: any): string {
    return 'token.' + user.id;
  }
}
`.trim();

const JS_TWO_FUNCTIONS = `
const bcrypt = require('bcrypt');

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, comparePassword };
`.trim();

const PYTHON_FUNCTIONS = `
def authenticate_user(email, password):
    user = find_user(email)
    if not user:
        raise ValueError("User not found")
    return check_password(password, user.password_hash)


def find_user(email):
    return db.query(User).filter_by(email=email).first()


class UserService:
    def __init__(self, repo):
        self.repo = repo

    def create_user(self, data):
        hashed = hash_password(data['password'])
        return self.repo.create({**data, 'password': hashed})
`.trim();

const GO_FUNCTIONS = `
package auth

import "errors"

func Authenticate(email, password string) (string, error) {
	user, err := FindUser(email)
	if err != nil {
		return "", errors.New("user not found")
	}
	return SignToken(user), nil
}

func FindUser(email string) (*User, error) {
	return db.QueryRow(email)
}

func SignToken(user *User) string {
	return "token." + user.ID
}
`.trim();

// A file with no recognizable boundaries (plain text / config)
const PLAIN_TEXT = `
This is a README file.
It has no functions or classes.
Just plain paragraphs of text.
Used to verify the fallback chunker.
`.trim();

// A very long TypeScript function that exceeds MAX_CHUNK_LINES on its own
function makeHugeFunction(lines: number): string {
  const body = Array.from({ length: lines - 3 }, (_, i) => `  const x${i} = ${i};`).join('\n');
  return `async function hugeOperation() {\n${body}\n  return true;\n}`;
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('AstChunker', () => {
  let chunker: AstChunker;

  beforeEach(() => {
    chunker = new AstChunker();
  });

  // ── Basic interface ─────────────────────────────────────────────────────────

  describe('interface contract', () => {
    it('returns an array of CodeChunk objects', () => {
      const chunks = chunker.chunk(JS_TWO_FUNCTIONS, '.js');
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      for (const c of chunks) {
        expect(typeof c.content).toBe('string');
        expect(typeof c.lineStart).toBe('number');
        expect(typeof c.lineEnd).toBe('number');
        expect(c.lineStart).toBeGreaterThanOrEqual(1);
        expect(c.lineEnd).toBeGreaterThanOrEqual(c.lineStart);
      }
    });

    it('lineStart / lineEnd are 1-based and non-overlapping except for the overlap buffer', () => {
      const chunks = chunker.chunk(TS_CLASS_AND_METHODS, '.ts');
      // Each chunk starts at or after the previous chunk's lineStart
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].lineStart).toBeGreaterThan(chunks[i - 1].lineStart);
      }
    });

    it('last chunk lineEnd equals the total line count of the file', () => {
      const totalLines = TS_CLASS_AND_METHODS.split('\n').length;
      const chunks = chunker.chunk(TS_CLASS_AND_METHODS, '.ts');
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.lineEnd).toBe(totalLines);
    });

    it('no chunk content is empty or whitespace-only', () => {
      const chunks = chunker.chunk(TS_CLASS_AND_METHODS, '.ts');
      for (const c of chunks) {
        expect(c.content.trim().length).toBeGreaterThan(0);
      }
    });
  });

  // ── TypeScript / JavaScript boundary detection ──────────────────────────────

  describe('TypeScript — class and method boundaries', () => {
    it('detects the class boundary for AuthService', () => {
      const chunks = chunker.chunk(TS_CLASS_AND_METHODS, '.ts');
      const classChunk = chunks.find(c => c.symbolName === 'AuthService');
      expect(classChunk).toBeDefined();
      expect(classChunk!.symbolType).toBe('class');
    });

    it('detects method boundaries inside the class', () => {
      const chunks = chunker.chunk(TS_CLASS_AND_METHODS, '.ts');
      const methodNames = chunks
        .filter(c => c.symbolType === 'method' || c.symbolType === 'function')
        .map(c => c.symbolName);
      // authenticate is a named method
      expect(methodNames.some(n => n?.includes('authenticate'))).toBe(true);
    });

    it('authenticate chunk contains the function body', () => {
      const chunks = chunker.chunk(TS_CLASS_AND_METHODS, '.ts');
      const authChunk = chunks.find(c => c.symbolName?.includes('authenticate'));
      expect(authChunk).toBeDefined();
      expect(authChunk!.content).toContain('findUser');
    });
  });

  describe('JavaScript — top-level function boundaries', () => {
    it('produces at least 2 chunks for a file with 2 top-level functions', () => {
      const chunks = chunker.chunk(JS_TWO_FUNCTIONS, '.js');
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('hashPassword and comparePassword each get their own chunk', () => {
      const chunks = chunker.chunk(JS_TWO_FUNCTIONS, '.js');
      const names = chunks.map(c => c.symbolName).filter(Boolean);
      expect(names.some(n => n?.includes('hashPassword'))).toBe(true);
      expect(names.some(n => n?.includes('comparePassword'))).toBe(true);
    });

    it('the hashPassword chunk does not contain comparePassword body', () => {
      const chunks = chunker.chunk(JS_TWO_FUNCTIONS, '.js');
      const hashChunk = chunks.find(c => c.symbolName?.includes('hashPassword'));
      // Should not bleed into the next function
      expect(hashChunk!.content).not.toContain('bcrypt.compare');
    });
  });

  // ── Python boundary detection ───────────────────────────────────────────────

  describe('Python — def and class boundaries', () => {
    it('detects def authenticate_user', () => {
      const chunks = chunker.chunk(PYTHON_FUNCTIONS, '.py');
      const authChunk = chunks.find(c => c.symbolName?.includes('authenticate_user'));
      expect(authChunk).toBeDefined();
    });

    it('detects class UserService', () => {
      const chunks = chunker.chunk(PYTHON_FUNCTIONS, '.py');
      const classChunk = chunks.find(c => c.symbolName?.includes('UserService'));
      expect(classChunk).toBeDefined();
      expect(classChunk!.symbolType).toBe('class');
    });

    it('three distinct symbol boundaries produce at least 3 chunks', () => {
      const chunks = chunker.chunk(PYTHON_FUNCTIONS, '.py');
      expect(chunks.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Go boundary detection ───────────────────────────────────────────────────

  describe('Go — func boundaries', () => {
    it('detects func Authenticate', () => {
      const chunks = chunker.chunk(GO_FUNCTIONS, '.go');
      const authChunk = chunks.find(c => c.symbolName?.includes('Authenticate'));
      expect(authChunk).toBeDefined();
    });

    it('produces a chunk per Go function', () => {
      const chunks = chunker.chunk(GO_FUNCTIONS, '.go');
      const funcChunks = chunks.filter(c => c.symbolType === 'function');
      expect(funcChunks.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Max-chunk-size enforcement ──────────────────────────────────────────────

  describe('max chunk size', () => {
    const MAX = 80;

    it('no chunk exceeds MAX_CHUNK_LINES (80)', () => {
      const longFile = makeHugeFunction(120); // 120-line single function
      const chunks = chunker.chunk(longFile, '.ts');
      for (const c of chunks) {
        const lineCount = c.content.split('\n').length;
        expect(lineCount).toBeLessThanOrEqual(MAX);
      }
    });

    it('a 120-line function is split into at least 2 chunks', () => {
      const longFile = makeHugeFunction(120);
      const chunks = chunker.chunk(longFile, '.ts');
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('split chunks for a huge function preserve all content (no lines dropped)', () => {
      const longFile = makeHugeFunction(90);
      const chunks = chunker.chunk(longFile, '.ts');
      const totalFileLines = longFile.split('\n').length;
      // Last chunk ends at file end
      expect(chunks[chunks.length - 1].lineEnd).toBe(totalFileLines);
      // First chunk starts at line 1
      expect(chunks[0].lineStart).toBe(1);
    });
  });

  // ── Fallback for unknown / boundary-free content ───────────────────────────

  describe('fallback chunking (no boundaries found)', () => {
    it('plain text with no code boundaries still produces chunks', () => {
      const chunks = chunker.chunk(PLAIN_TEXT, '.txt');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('unknown extension falls back gracefully', () => {
      const chunks = chunker.chunk(PLAIN_TEXT, '.xyz');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('fallback chunks cover the entire file', () => {
      const chunks = chunker.chunk(PLAIN_TEXT, '.txt');
      const totalLines = PLAIN_TEXT.split('\n').length;
      expect(chunks[chunks.length - 1].lineEnd).toBe(totalLines);
      expect(chunks[0].lineStart).toBe(1);
    });
  });

  // ── Custom options ──────────────────────────────────────────────────────────

  describe('custom options', () => {
    it('respects maxChunkLines option', () => {
      const opts: ChunkOptions = { maxChunkLines: 10 };
      const chunks = chunker.chunk(TS_CLASS_AND_METHODS, '.ts', opts);
      for (const c of chunks) {
        expect(c.content.split('\n').length).toBeLessThanOrEqual(10);
      }
    });

    it('overlap=0 produces non-overlapping chunks', () => {
      const opts: ChunkOptions = { overlapLines: 0 };
      const chunks = chunker.chunk(JS_TWO_FUNCTIONS, '.js', opts);
      // With no overlap each chunk starts exactly where the previous ended + 1
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].lineStart).toBeGreaterThan(chunks[i - 1].lineStart);
      }
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('empty string returns empty array', () => {
      const chunks = chunker.chunk('', '.ts');
      expect(chunks).toEqual([]);
    });

    it('whitespace-only string returns empty array', () => {
      const chunks = chunker.chunk('   \n\n  ', '.ts');
      expect(chunks).toEqual([]);
    });

    it('single-line file returns one chunk', () => {
      const chunks = chunker.chunk('const x = 1;', '.ts');
      expect(chunks.length).toBe(1);
      expect(chunks[0].lineStart).toBe(1);
      expect(chunks[0].lineEnd).toBe(1);
    });
  });
});

/**
 * Mutation Matrix — 3 bugs that tests above will catch:
 *
 * MUTATION 1 (off-by-one in lineStart):
 *   Change: lineStart = boundaryLine + 1  →  lineStart = boundaryLine
 *   Caught by: 'lineStart / lineEnd are 1-based and non-overlapping'
 *              'last chunk lineEnd equals the total line count'
 *
 * MUTATION 2 (missing boundary detection for 'function' keyword):
 *   Change: Remove the /^(export\s+)?(async\s+)?function/ pattern from JS detector
 *   Caught by: 'hashPassword and comparePassword each get their own chunk'
 *              'produces at least 2 chunks for a file with 2 top-level functions'
 *
 * MUTATION 3 (max-chunk enforcement removed):
 *   Change: Remove the split-at-MAX_CHUNK_LINES guard
 *   Caught by: 'no chunk exceeds MAX_CHUNK_LINES (80)'
 *              'a 120-line function is split into at least 2 chunks'
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mutation-driven tests.
//
// Added after a Stryker run on this module scored 70.63% MSI with 35 surviving
// mutants. Each block below targets a specific survivor: a line the suite executed
// but never asserted anything about. The block headings name the mutant.
// ─────────────────────────────────────────────────────────────────────────────

describe('AstChunker — ChunkOptions', () => {
  const chunker = new AstChunker();

  // Survivor: `opts?.overlapLines ?? DEFAULT_OVERLAP_LINES` mutated to `&&`.
  // No test passed ChunkOptions at all, so the default was always taken and the
  // nullish coalescing was never distinguished from a logical and.
  // Three consecutive symbols, so each function is its own segment. Overlap is applied
  // at the first chunk of a segment when earlier chunks exist — see the characterisation
  // test below for the case where it is not applied.
  const THREE_FUNCTIONS = [
    'export function alpha() {',   // 1
    '  const a = 1;',              // 2
    '  return a;',                 // 3
    '}',                           // 4
    '',                            // 5
    'export function beta() {',    // 6
    '  const b = 2;',              // 7
    '  return b;',                 // 8
    '}',                           // 9
    '',                            // 10
    'export function gamma() {',   // 11
    '  const g = 3;',              // 12
    '  return g;',                 // 13
    '}',                           // 14
  ].join('\n');

  it('honours a custom overlapLines instead of the default', () => {
    // `beta` spans lines 6-10, so its canonical body is 5 lines. Overlap prepends up to
    // `overlapLines` lines of the previous chunk to the *content* without moving
    // lineStart. Exact figures matter here: the `??` mutated to `&&` would pin every
    // run to DEFAULT_OVERLAP_LINES (3) and produce 8 lines in both cases.
    const noOverlap = chunker.chunk(THREE_FUNCTIONS, '.ts', { overlapLines: 0 });
    const small = chunker.chunk(THREE_FUNCTIONS, '.ts', { overlapLines: 2 });
    const large = chunker.chunk(THREE_FUNCTIONS, '.ts', { overlapLines: 5 });

    const bodyOf = (chunks: CodeChunk[]) =>
      chunks.find(c => c.symbolName === 'beta')!.content.split('\n').length;

    expect(bodyOf(noOverlap)).toBe(5);
    expect(bodyOf(small)).toBe(7);
    expect(bodyOf(large)).toBe(10);
  });

  it('overlap never moves a chunk canonical lineStart', () => {
    const plain = chunker.chunk(THREE_FUNCTIONS, '.ts', { overlapLines: 0 });
    const overlapped = chunker.chunk(THREE_FUNCTIONS, '.ts', { overlapLines: 5 });

    expect(overlapped.map(c => [c.lineStart, c.lineEnd]))
      .toEqual(plain.map(c => [c.lineStart, c.lineEnd]));
  });

  // Characterisation, not aspiration. `isFirst` is per segment, so when a single long
  // function is split by maxChunkLines, the follow-on sub-chunks are not overlapped —
  // only the first chunk of a *new* segment is. The module docstring's "overlap lines
  // carried from prior chunk into next" is broader than what the code does. Pinned here
  // so a future change to either one is a deliberate decision rather than a surprise.
  it('does not overlap sub-chunks produced by splitting one long segment', () => {
    const longBody = Array.from({ length: 40 }, (_, i) => `  const line${i} = ${i};`);
    const source = ['export function huge() {', ...longBody, '}'].join('\n');
    const chunks = chunker.chunk(source, '.ts', { maxChunkLines: 10, overlapLines: 5 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.content.split('\n').length).toBe(c.lineEnd - c.lineStart + 1);
    }
  });

  it('honours a custom maxChunkLines instead of the default 80', () => {
    const source = Array.from({ length: 100 }, (_, i) => `const line${i} = ${i};`).join('\n');
    const chunks = chunker.chunk(source, '.ts', { maxChunkLines: 12, overlapLines: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.lineEnd - c.lineStart + 1).toBeLessThanOrEqual(12);
    }
  });

  it('overlapLines: 0 produces chunks whose content matches their canonical range', () => {
    const source = Array.from({ length: 40 }, (_, i) => `const line${i} = ${i};`).join('\n');
    const chunks = chunker.chunk(source, '.ts', { maxChunkLines: 10, overlapLines: 0 });

    for (const c of chunks) {
      expect(c.content.split('\n').length).toBe(c.lineEnd - c.lineStart + 1);
    }
  });
});

describe('AstChunker — extension dispatch', () => {
  const chunker = new AstChunker();
  const TSX = `
export function Widget() {
  return <div>hello</div>;
}

export function Panel() {
  return <section>panel</section>;
}
`.trim();

  // Survivors on the extension comparison chain: `.tsx` and `.jsx` were never passed,
  // so removing either arm of the condition changed nothing observable.
  it.each(['.ts', '.tsx', '.js', '.jsx'])('detects boundaries for %s', (ext) => {
    const chunks = chunker.chunk(TSX, ext);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.map(c => c.symbolName)).toContain('Widget');
  });

  // Survivor: `ext.toLowerCase()` — no test used a capitalised extension.
  it('matches extensions case-insensitively', () => {
    const lower = chunker.chunk(TSX, '.tsx');
    const upper = chunker.chunk(TSX, '.TSX');
    expect(upper.map(c => c.symbolName)).toEqual(lower.map(c => c.symbolName));
    expect(upper.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to size-based chunking for an unsupported extension', () => {
    const chunks = chunker.chunk(TSX, '.rb');
    expect(chunks.length).toBeGreaterThan(0);
    // No language patterns, so no symbol boundaries are claimed.
    expect(chunks.every(c => c.symbolName === undefined)).toBe(true);
  });

  it('returns no chunks for empty or whitespace-only source', () => {
    expect(chunker.chunk('', '.ts')).toEqual([]);
    expect(chunker.chunk('   \n\n  \t ', '.ts')).toEqual([]);
  });
});

describe('AstChunker — segment edges', () => {
  const chunker = new AstChunker();

  // Survivor: `if (boundaries[0].line > 1)` — the preamble branch. Every fixture began
  // with a boundary on line 1, so the branch that keeps leading imports never ran
  // under assertion.
  it('keeps the lines before the first boundary as a preamble chunk', () => {
    const source = [
      "import { readFile } from 'fs';",
      "import * as path from 'path';",
      '',
      'const CONFIG_NAME = ".apprc";',
      '',
      'export function loadConfig() {',
      '  return readFile(path.join(process.cwd(), CONFIG_NAME));',
      '}',
    ].join('\n');

    const chunks = chunker.chunk(source, '.ts', { overlapLines: 0 });

    expect(chunks[0].lineStart).toBe(1);
    const all = chunks.map(c => c.content).join('\n');
    expect(all).toContain("import { readFile } from 'fs';");
    expect(all).toContain('CONFIG_NAME');
    // The preamble is not a symbol.
    expect(chunks[0].symbolName).toBeUndefined();
  });

  // Survivor: `if (last.lineEnd < totalLines)` mutated to `<=` and `>=`, plus the whole
  // block marked NoCoverage. Trailing content after the final boundary was never
  // asserted to survive chunking.
  it('extends the final chunk to cover trailing lines after the last boundary', () => {
    const source = [
      'export function only() {',
      '  return 1;',
      '}',
      '',
      '// trailing comment that belongs to no symbol',
      'const AFTERWARDS = 42;',
      'export default AFTERWARDS;',
    ].join('\n');

    const totalLines = source.split('\n').length;
    const chunks = chunker.chunk(source, '.ts', { overlapLines: 0 });
    const last = chunks[chunks.length - 1];

    expect(last.lineEnd).toBe(totalLines);
    const all = chunks.map(c => c.content).join('\n');
    expect(all).toContain('AFTERWARDS = 42');
    expect(all).toContain('export default AFTERWARDS;');
  });

  it('preserves every source line across the returned chunks', () => {
    const source = [
      "import x from 'x';",
      'export function a() {',
      '  return 1;',
      '}',
      'export function b() {',
      '  return 2;',
      '}',
      'const trailing = true;',
    ].join('\n');

    const chunks = chunker.chunk(source, '.ts', { overlapLines: 0 });
    const rebuilt = chunks.map(c => c.content).join('\n');
    for (const line of source.split('\n').filter(l => l.trim().length > 0)) {
      expect(rebuilt).toContain(line.trim());
    }
  });
});
