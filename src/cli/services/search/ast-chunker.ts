/**
 * AstChunker — Regex-based AST-boundary chunk splitter
 *
 * Splits source files at symbol boundaries (class, function, method) rather than
 * fixed line counts. Each chunk carries metadata about the symbol it contains.
 *
 * Supported languages: TypeScript (.ts, .tsx), JavaScript (.js, .jsx), Python (.py), Go (.go)
 * Unsupported extensions fall back to fixed-size splitting.
 *
 * Design constraints:
 *  - No native bindings (no tree-sitter, no node-gyp)
 *  - Max chunk size: MAX_CHUNK_LINES (default 80) — always honoured
 *  - Overlap: OVERLAP_LINES (default 3) — last N lines of prior chunk prepended to next
 *  - Never drops lines — lineEnd of last chunk always equals file line count
 */

export interface CodeChunk {
  /** The source text of this chunk (may include overlap lines from prior chunk) */
  content: string;
  /** 1-based line number where this chunk starts in the original file */
  lineStart: number;
  /** 1-based line number where this chunk ends in the original file */
  lineEnd: number;
  /** Name of the primary symbol this chunk belongs to, if detected */
  symbolName?: string;
  /** Type of the primary symbol */
  symbolType?: 'class' | 'function' | 'method' | 'unknown';
}

export interface ChunkOptions {
  /** Maximum number of lines per chunk (default: 80) */
  maxChunkLines?: number;
  /** Number of overlap lines carried from prior chunk (default: 3) */
  overlapLines?: number;
}

// ── Boundary detection ────────────────────────────────────────────────────────

interface BoundaryMatch {
  line: number; // 1-based line index in the file
  symbolName: string;
  symbolType: 'class' | 'function' | 'method';
}

// TypeScript / JavaScript boundary patterns
const TS_JS_PATTERNS: Array<{ re: RegExp; symbolType: 'class' | 'function' | 'method' }> = [
  {
    re: /^\s*(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+([A-Z][A-Za-z0-9_]*)/,
    symbolType: 'class',
  },
  {
    re: /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
    symbolType: 'function',
  },
  {
    re: /^\s*(?:public|private|protected|static|async|override|abstract|\s)*(?:async\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/,
    symbolType: 'method',
  },
  {
    re: /^\s*(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?\(/,
    symbolType: 'function',
  },
];

// Python boundary patterns
const PY_PATTERNS: Array<{ re: RegExp; symbolType: 'class' | 'function' | 'method' }> = [
  { re: /^class\s+([A-Za-z_][A-Za-z0-9_]*)/, symbolType: 'class' },
  { re: /^def\s+([A-Za-z_][A-Za-z0-9_]*)/, symbolType: 'function' },
  { re: /^\s{4}def\s+([A-Za-z_][A-Za-z0-9_]*)/, symbolType: 'method' },
];

// Go boundary patterns
const GO_PATTERNS: Array<{ re: RegExp; symbolType: 'class' | 'function' | 'method' }> = [
  { re: /^type\s+([A-Za-z_][A-Za-z0-9_]*)\s+struct/, symbolType: 'class' },
  { re: /^func\s+([A-Za-z_][A-Za-z0-9_]*)/, symbolType: 'function' },
  { re: /^func\s+\([^)]+\)\s+([A-Za-z_][A-Za-z0-9_]*)/, symbolType: 'method' },
];

type LangPatterns = typeof TS_JS_PATTERNS;

function patternsForExtension(ext: string): LangPatterns | null {
  const lower = ext.toLowerCase();
  if (lower === '.ts' || lower === '.tsx' || lower === '.js' || lower === '.jsx') {
    return TS_JS_PATTERNS;
  }
  if (lower === '.py') return PY_PATTERNS as LangPatterns;
  if (lower === '.go') return GO_PATTERNS as LangPatterns;
  return null;
}

function detectBoundaries(lines: string[], patterns: LangPatterns): BoundaryMatch[] {
  const matches: BoundaryMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    for (const { re, symbolType } of patterns) {
      const m = lineText.match(re);
      if (m && m[1]) {
        // Prefer earlier patterns (class > function > method) if same line matches multiple
        matches.push({ line: i + 1, symbolName: m[1], symbolType });
        break;
      }
    }
  }
  return matches;
}

// ── Chunk splitting ───────────────────────────────────────────────────────────

const DEFAULT_MAX_CHUNK_LINES = 80;
const DEFAULT_OVERLAP_LINES = 3;

/**
 * Splits `lines` into chunks, each at most `maxChunkLines` lines.
 * When a chunk would exceed that limit it is hard-split, preserving content.
 */
function splitByBoundariesAndMax(
  lines: string[],
  boundaries: BoundaryMatch[],
  maxChunkLines: number,
  overlapLines: number
): CodeChunk[] {
  if (lines.length === 0) return [];

  const totalLines = lines.length;

  // Build a list of raw segments: [startLine(1-based), endLine(1-based), symbol]
  const segments: Array<{ start: number; end: number; symbolName?: string; symbolType?: 'class' | 'function' | 'method' }> = [];

  if (boundaries.length === 0) {
    // No boundaries — one big segment covering the entire file
    segments.push({ start: 1, end: totalLines });
  } else {
    for (let i = 0; i < boundaries.length; i++) {
      const start = boundaries[i].line;
      const end = i + 1 < boundaries.length ? boundaries[i + 1].line - 1 : totalLines;
      segments.push({
        start,
        end,
        symbolName: boundaries[i].symbolName,
        symbolType: boundaries[i].symbolType,
      });
    }
    // If there are lines before the first boundary, add a preamble segment
    if (boundaries[0].line > 1) {
      segments.unshift({ start: 1, end: boundaries[0].line - 1 });
    }
  }

  // Expand each segment, splitting at maxChunkLines as needed.
  // lineStart/lineEnd reflect the canonical (non-overlap) position in the file.
  // Overlap lines are prepended to content only, without changing lineStart.
  const chunks: CodeChunk[] = [];
  for (const seg of segments) {
    let cursor = seg.start;
    let isFirst = true;
    while (cursor <= seg.end) {
      const canonicalStart = cursor;
      const rawEnd = Math.min(cursor + maxChunkLines - 1, seg.end);

      // For the first sub-chunk of a segment, prepend overlap from the prior chunk
      let contentLineStart = canonicalStart;
      if (isFirst && chunks.length > 0 && overlapLines > 0) {
        const prev = chunks[chunks.length - 1];
        contentLineStart = Math.max(prev.lineEnd - overlapLines + 1, prev.lineStart);
        // Never go back past the canonical start of the prior chunk
        contentLineStart = Math.min(contentLineStart, canonicalStart);
      }

      const contentLines = lines.slice(contentLineStart - 1, rawEnd);
      const content = contentLines.join('\n');

      chunks.push({
        content,
        lineStart: canonicalStart,
        lineEnd: rawEnd,
        symbolName: isFirst ? seg.symbolName : undefined,
        symbolType: isFirst ? seg.symbolType : undefined,
      });
      cursor = rawEnd + 1;
      isFirst = false;
    }
  }

  // Ensure last chunk covers the true end of file
  if (chunks.length > 0) {
    const last = chunks[chunks.length - 1];
    if (last.lineEnd < totalLines) {
      const extraLines = lines.slice(last.lineEnd, totalLines);
      chunks[chunks.length - 1] = {
        ...last,
        content: last.content + '\n' + extraLines.join('\n'),
        lineEnd: totalLines,
      };
    }
  }

  return chunks;
}

// ── Public API ────────────────────────────────────────────────────────────────

export class AstChunker {
  chunk(source: string, extension: string, opts?: ChunkOptions): CodeChunk[] {
    if (!source || source.trim().length === 0) return [];

    const maxChunkLines = opts?.maxChunkLines ?? DEFAULT_MAX_CHUNK_LINES;
    const overlapLines  = opts?.overlapLines  ?? DEFAULT_OVERLAP_LINES;

    const lines = source.split('\n');
    const patterns = patternsForExtension(extension);

    let boundaries: BoundaryMatch[] = [];
    if (patterns) {
      boundaries = detectBoundaries(lines, patterns);
    }

    return splitByBoundariesAndMax(lines, boundaries, maxChunkLines, overlapLines);
  }
}




