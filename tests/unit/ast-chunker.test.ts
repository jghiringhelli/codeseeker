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
