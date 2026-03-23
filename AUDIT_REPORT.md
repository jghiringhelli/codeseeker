╔══════════════════════════════════════════════════════════════════════════════╗
║           CODESEEKER MCP SERVER - PROMPT HYGIENE AUDIT REPORT                ║
║                         Comprehensive Analysis                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

PROJECT: C:\workspace\claude\CodeSeeker
FILES: src/mcp/mcp-server.ts (1,785 lines) + CLAUDE.md (1,040 lines)

════════════════════════════════════════════════════════════════════════════════
1. TOOL DEFINITION VERBOSITY
════════════════════════════════════════════════════════════════════════════════

SENTINEL TOOL: "codeseeker" (Single entry point)
Location: src/mcp/mcp-server.ts:446-561

Main description (line 450):
  "Code intelligence: search (q), symbol lookup (sym), graph traversal (graph), 
   analysis (analyze), index management (index)."
  ✓ 95 characters, 19 words - COMPACT

NESTED PARAMETERS: 28 total
  Top-level: action (enum[5]) + project (optional string)
  
  Breakdown by action:
    • search  - 5 params (q, exists, full, limit, type)
    • sym     - 2 params (name, full)
    • graph   - 6 params (seed, q, depth, rel, dir, max)
    • analyze - 5 params (kind, threshold, min_lines, patterns, category)
    • index   - 10 params (op, path, name, changes, full_reindex, languages, etc.)

Each parameter has a description: avg 7-15 words

SCHEMA TOKEN COST: 250-350 tokens total
  Structure: ~150 tokens (enums, object definitions, nesting)
  Descriptions: ~100-150 tokens (tool + param descriptions)
  Overhead per action: ~50 tokens

ASSESSMENT:
  ✓ Tool description is tight (single sentence)
  ✓ Nested groups well-organized (search, sym, graph, analyze, index)
  ⚠️  28 nested params creates moderate complexity
  ⚠️  index action has 10 params alone

════════════════════════════════════════════════════════════════════════════════
2. RESPONSE PAYLOAD SIZES - WHAT'S RETURNED BY DEFAULT
════════════════════════════════════════════════════════════════════════════════

ACTION: search
Handler: handleSearch (lines 572-642)

DEFAULT FORMAT (full:false):
  Per-result fields:
    {rank, file, score, lines, sig}
  
  Field sizes:
    rank  - 4 chars (~1 token)
    file  - 30-50 chars (~10 tokens average)
    score - 4 chars (~1 token) [always 2 decimals: 0.00-0.95]
    lines - "N-M" format (~3 tokens) [omitted if unknown]
    sig   - 120-char max (~30 tokens) [first declaration line]
  
  Per-result tokens: 40-50 tokens compact
  Default limit: 10 results
  Response metadata: ~50 tokens (query, project, count, more field)
  TYPICAL TOTAL: ~650-700 tokens

WITH full:true:
  ADDS: snippet field (300 chars max + "…" if truncated)
  Per snippet: ~75 tokens
  Per-result tokens: 120-150 tokens (3x increase)
  10 results: ~1,500 tokens
  TYPICAL TOTAL: ~1,550-1,650 tokens

ASSESSMENT:
  ✓ Compact by default (650 tokens for 10 results)
  ✓ full:true is opt-in (not forced)
  ✓ Limit reasonable (10 items)
  ⚠️  full:true 2.4x token cost per request

---

ACTION: sym (symbol lookup)
Handler: handleSymbolLookup (lines 1620-1700)

DEFAULT FORMAT (full:false):
  Per-result fields:
    {name, type, file, in, out}
  
  Default limit: 20 results (top 20 matches)
  Per-result tokens: 40-50 tokens
  Metadata overhead: ~30 tokens
  TYPICAL TOTAL: ~830-850 tokens

WITH full:true (lines 1684-1691):
  ADDS: edges array (up to 15 resolved edges max per symbol)
  Each edge: {rel: type, dir: in|out, name, type, file}
  Per edge: ~30 tokens
  Max per symbol: 15 × 30 = ~450 tokens extra
  Worst case: 20 symbols × 15 edges × 30 tokens = 9,000 tokens
  ACTUAL TYPICAL: 20 symbols × (8-10 edges avg) = 1,800-1,900 tokens

ASSESSMENT:
  ✓ Compact default (830 tokens)
  ⚠️  full:true can be expensive if symbols have many edges
  ⚠️  20 result default is high (could be 10)

---

ACTION: graph (dependency traversal)
Handler: handleShowDependencies (lines 649-819)

RESPONSE STRUCTURE:
  graph_stats - 50 tokens (4 counters)
  seed_files - 100 tokens (1-5 files × 20 tokens each)
  traversal params - 30 tokens (metadata)
  results summary - 50 tokens (counts and flags)
  nodes - (max_nodes × 30 tokens) - Line 799: nodes array
  relationships - (edges × 20 tokens) - Line 800: edge array
  truncation warning - 50 tokens (if truncated)

Default max_nodes: 50 (line 475)
Typical nodes returned: 30-50
Typical edges: 30-100

TYPICAL RESPONSE:
  50 nodes × 25 tokens + 50 edges × 20 tokens + overhead = 1,800-2,200 tokens

ASSESSMENT:
  ✓ Bounded by max_nodes (50 default)
  ✓ Includes truncation warnings
  ⚠️  Large responses (1,800-2,200 tokens typical)

---

ACTION: analyze (code quality analysis)

THREE VARIANTS:

1. Duplicates (lines 821-935):
  Response: {project, summary, duplicate_groups, recommendations}
  Per group (max 20): {type, similarity%, files_affected, locations[...]}
  Each location: {file, lines, preview (100 chars)}
  Per group: ~100-150 tokens
  20 groups + summaries + recommendations: 2,500-3,500 tokens

2. Dead code (lines 937-1141):
  Response: {project, graph_stats, graph_limitations[3], summary, 
            dead_code[], orphaned_files[], anti_patterns[], coupling_issues[]}
  
  graph_limitations - 3 warnings × 50 tokens = 150 tokens
  dead_code - 20 items × 60 tokens each = 1,200 tokens
  orphaned_files - 20 items × 50 tokens = 1,000 tokens
  anti_patterns - 10 items × 60 tokens = 600 tokens
  coupling_issues - 10 items × 60 tokens = 600 tokens
  TOTAL: 3,500-4,500 tokens

3. Standards (lines 1143-1190):
  Loads JSON from disk (.codeseeker/coding-standards.json)
  Depends on project size
  Typical: 1,500-3,000 tokens

ASSESSMENT:
  ⚠️  ANALYZE RESPONSES ARE LARGEST (2,000-4,500 tokens)
  ⚠️  dead_code includes 3 graph_limitations warnings (150 tokens)
  ⚠️  Descriptions and recommendations verbose (800+ tokens)
  ⚠️  20 items default for some arrays (could be truncated)

════════════════════════════════════════════════════════════════════════════════
3. CLAUDE.MD TOOL DOCUMENTATION SECTION
════════════════════════════════════════════════════════════════════════════════

Location: CLAUDE.md lines 957-1040 (84 lines, 4,687 chars)

Estimated tokens: 1,172 tokens

CONTENTS:
  "CRITICAL: Always pass project parameter" - 120 tokens
    Warns about multi-project scenarios
    NOT in tool schema (GOOD)

  "Auto-Initialization Check" - 100 tokens
    Operational checklist before search
    NOT in tool schema (GOOD)

  "When to Use CodeSeeker" - 150 tokens
    Use cases (search, sym, graph, analyze)
    NOT in tool schema (GOOD)

  "Tool Actions Table" - 80 tokens (lines 1025-1031)
    Repeats action names, params, and purposes
    PARTIALLY REDUNDANT with tool schema
    BUT more compact and human-readable

  "When to Use grep/glob" - 100 tokens
    Explains when to fall back to grep
    NOT in tool schema (GOOD)

  "Keep Index Updated" - 50 tokens
    Sync guidance
    NOT in tool schema (GOOD)

REDUNDANCY ANALYSIS:
  ~15-20% overlap with tool schema (mainly the tool action table)
  ~80-85% unique operational guidance (when/why/how to use)
  
  Tool schema = "What parameters exist" (technical)
  CLAUDE.md = "When to use tools" (operational)
  
  ✓ GOOD separation of concerns
  ⚠️  Could consolidate tool action table into single reference

ASSESSMENT:
  ✓ Rich operational guidance (1,172 tokens well spent)
  ⚠️  Adds 1,172 tokens per session if included in context
  ✓ Mostly non-redundant with schema

════════════════════════════════════════════════════════════════════════════════
4. SEARCH RESULT FORMAT
════════════════════════════════════════════════════════════════════════════════

DEFAULT (full:false):
  Compact object: {rank, file, score, lines, sig}
  
  rank   - User position in results (1, 2, 3...)
  file   - Relative path (actionable, can pass to view tool)
  score  - 2-decimal number (0.00-0.95 range, Math.round logic at line 627)
  lines  - "startLine-endLine" format, undefined if unknown
  sig    - First declaration line (120-char max)

SIGNATURE EXTRACTION (lines 564-570):
  Skip lines matching: whitespace, comments, imports, requires, using, namespace
  Result: First meaningful declaration line
  Truncated to 120 chars
  Example: "export class AuthenticationService {"

✓ COMPACT - 5 fields, all focused on essentials
✓ ACTIONABLE - file paths are relative (ready to use)
✓ BOUNDED - signature and snippet have hard limits

WITH full:true:
  ADDS: snippet field
  Logic (line 631): snippet = content.substring(0, 300) + (length > 300 ? "…" : "")
  
  ✓ Hard limit: 300 characters
  ✓ Truncation indicator: "…"
  ⚠️  No newline normalization (preserves raw code)

ASSESSMENT:
  ✓ Format is tight and efficient
  ✓ Default mode is minimal (5 fields)
  ✓ Limits well-chosen (120 sig, 300 snippet, 10 results)
  ✓ Optional full mode for detailed review

════════════════════════════════════════════════════════════════════════════════
5. INSTRUCTION DUPLICATION
════════════════════════════════════════════════════════════════════════════════

TOOL SCHEMA INSTRUCTIONS (mcp-server.ts):
  Main tool description: "Code intelligence..." (24 tokens)
  Nested descriptions: search, sym, graph, analyze, index (25 tokens)
  Parameter descriptions: 28 params × avg 3 tokens = 84 tokens
  TOTAL: ~130 tokens of instruction

CLAUDE.MD INSTRUCTIONS (1,172 tokens):
  Operational guidance, use cases, examples, patterns
  NOT replicated in tool schema

OVERLAP:
  Action names: search, sym, graph, analyze, index (in both places)
    → Necessary for discoverability
    → Not really duplication

  Parameter info:
    → Tool schema has full technical details
    → CLAUDE.md has simplified table (lines 1025-1031)
    → ~20 tokens of table duplication

  Use cases:
    → Tool schema: Missing entirely
    → CLAUDE.md: Extensive examples
    → No duplication

VERDICT:
  ~15% of CLAUDE.md content overlaps with tool schema
  Mostly in the tool action table (lines 1025-1031)
  Rest is unique operational guidance

RECOMMENDATION:
  Current split is GOOD
  Could save ~20 tokens by removing the action table from CLAUDE.md
  But trade-off: less discoverable for users reading CLAUDE.md

════════════════════════════════════════════════════════════════════════════════
6. THE full:true PATH - BOUNDS & COSTS
════════════════════════════════════════════════════════════════════════════════

SEARCH full:true:
  Option added at line 459
  Adds: snippet field (300 chars max)
  Cost increase: ~450 tokens per 10-result query (45 tokens/result)
  Bounded: YES (300-char hard limit)
  Reasonable use: Review relevant code before opening file

SYM full:true:
  Option added at line 466
  Adds: edges array up to 15 items per symbol
  Each edge includes: rel, dir, name, type, file
  Cost increase: Varies by connectivity
    → Tight graph: 8-10 edges × 30 tokens = 240 tokens extra
    → Dense graph: 15 edges × 30 tokens = 450 tokens extra
  Total impact: 20 symbols × (240-450) = 4,800-9,000 tokens potential
  Bounded: YES (15 edges per symbol hard limit at line 1685)
  
  ⚠️  CONCERN: If user has 20 highly-connected symbols, response is 9,000 tokens
  Mitigation: 15-edge limit prevents runaway growth

GRAPH (inherent complexity):
  No full: flag (always returns all nodes/edges within max_nodes)
  Bounded by: max_nodes (default 50, line 475)
  At 50 nodes + 50 edges: ~2,000 tokens
  ✓ Reasonable bounds

ASSESSMENT:
  ✓ All full: paths are bounded
  ✓ Bounds are reasonable
  ⚠️  sym full: could still hit 9,000 tokens in worst case
      Mitigation exists (15-edge slice) but not restrictive enough for dense graphs

════════════════════════════════════════════════════════════════════════════════
7. TOKEN ESTIMATES SUMMARY
════════════════════════════════════════════════════════════════════════════════

ONE-TIME COSTS:
  Tool schema registration: 250-350 tokens

TYPICAL REQUEST COSTS:

  Search (default):
    Compact: 650-700 tokens
    With full:true: 1,550-1,650 tokens
    Range: 650-1,650 tokens

  Symbol lookup (default):
    Compact: 830-850 tokens
    With full:true: 1,800-1,900 tokens
    Range: 830-1,900 tokens

  Graph traversal:
    Small (10 nodes): 800-900 tokens
    Medium (25 nodes): 1,200-1,400 tokens
    Large (50 nodes max): 1,800-2,200 tokens
    Range: 800-2,200 tokens

  Analysis:
    Duplicates: 2,500-3,500 tokens
    Dead code: 3,500-4,500 tokens
    Standards: 1,500-3,000 tokens
    Range: 1,500-4,500 tokens

SESSION CONTEXT:
  CLAUDE.md MCP section (if included): 1,172 tokens
  Tool schema (one-time): 300 tokens

EXAMPLE SESSION:
  Tool schema: 300 tokens (one-time)
  CLAUDE.md section: 1,172 tokens (if included in system prompt)
  1 search: 700 tokens
  1 sym lookup: 850 tokens
  1 analyze: 3,500 tokens
  ────────────────────
  TOTAL: ~7,022 tokens per typical multi-tool session

════════════════════════════════════════════════════════════════════════════════
8. UNNECESSARILY LARGE FIELDS
════════════════════════════════════════════════════════════════════════════════

✓ TIGHTLY OPTIMIZED:
  search.rank - Single digit
  search.file - Relative path (essential, minimal)
  search.score - 2 decimals (sufficient precision)
  search.sig - 120-char limit (good balance)
  search.snippet - 300-char limit (reasonable preview)
  sym.in/out - Edge counts (minimal)
  graph stats - Essential summaries
  graph truncation warning - Important context

⚠️  VERBOSE FIELDS:

  dead_code.graph_limitations (line 1123):
    3 warnings about analysis limits
    ~150 tokens total
    Valuable context, but could be optional or summarized
    Example warning: "Call edges use regex heuristics — dynamic dispatch,
                      callbacks, and event handlers are not detected."
    
  duplicate_groups.locations (line 910):
    Per group lists all affected files with line ranges
    Could be summarized as count + top 3 files
    Saves ~100 tokens per group
    
  dead_code items descriptions (lines 1014-1020):
    Each item includes: type, name, file, description, confidence, 
                       impact, recommendation
    ~60 tokens per item
    20 items × 60 = 1,200 tokens
    Description + recommendation could be condensed
    
  recommendation field (lines 928-932):
    Provides actionable guidance ("Found X groups - prioritize...")
    ~50 tokens per analyze call
    Valuable but not strictly necessary

ASSESSMENT:
  Dead code response is most verbose (graph_limitations + full descriptions)
  Duplicate/analyze responses could be streamlined by:
    - Removing verbose descriptions (keep summary only)
    - Making recommendations optional field
    - Summarizing location lists

════════════════════════════════════════════════════════════════════════════════
9. IDEAL "TIGHT" VERSION RECOMMENDATIONS
════════════════════════════════════════════════════════════════════════════════

CURRENT COST PROFILE:
  Tool schema: 300 tokens (one-time)
  Typical session: 7,000 tokens
  CLAUDE.md section: 1,172 tokens (if included)

OPTIMIZATION TIERS:

TIER 1 - QUICK WINS (10-15% savings, minimal impact):

  1. Remove graph_limitations from dead_code response
     Current: 150 tokens per analyze call
     Savings: 150 tokens
     Trade-off: Users lose context about analysis limitations
     Verdict: NOT RECOMMENDED (context is valuable)
  
  2. Make recommendations field optional (default: false)
     Current: 50 tokens per analyze call
     Savings: 50 tokens
     Alternative: Include in separate optional response
     Verdict: GOOD - add recommendations: true param
  
  3. Reduce dead_code description verbosity
     Current: "Long description" + "Recommendation"
     Target: Summary only
     Savings: ~400 tokens per dead_code response
     Trade-off: Less guidance
     Verdict: CONDITIONAL - users need recommendations for action
  
  4. Truncate duplicate group locations to top 3 files
     Current: All affected files listed
     Savings: ~100 tokens per duplicate group
     Trade-off: Users miss some locations
     Verdict: GOOD - show summary + "See X more files"

TIER 2 - STRUCTURAL CHANGES (20-30% savings, moderate impact):

  1. Compress sym.full edge payload
     Current: 20 symbols × 10-15 edges × 30 tokens = 6,000-9,000 tokens potential
     Option A: Return only edge types (dir:in|out, type) without peer details
       Savings: 70% reduction (4,000-6,000 tokens)
       Trade-off: Users can't see what's calling/used by symbol
       Verdict: NOT RECOMMENDED - defeats purpose of full:true
     
     Option B: Limit to 5 edges per symbol instead of 15
       Savings: 67% reduction (from 9,000 to 3,000 tokens max)
       Trade-off: Misses some relationships
       Verdict: GOOD - reasonable compromise
  
  2. Reduce analyze result arrays from 20 items to 10
     Current: dead_code 20, orphaned_files 20, etc.
     Savings: 50% (1,000-2,000 tokens per call)
     Trade-off: Fewer issues detected per call
     Verdict: CONDITIONAL - users may need to iterate
  
  3. Make snippet field optional (default: false)
     Current: All results include snippet
     Alternative: snippet: false (no snippet), snippet: true (300 chars)
     Savings: ~450 tokens per search with default false
     Verdict: ALREADY EXISTS (full:true flag does this)
  
  4. Minify JSON output (remove pretty-printing)
     Current: JSON.stringify(..., null, 2)
     Target: JSON.stringify(...)
     Savings: ~20% of all response tokens (~140-280 tokens per response)
     Trade-off: Responses harder to read
     Verdict: NOT RECOMMENDED for debugging, acceptable for production

TIER 3 - OPERATIONAL CHANGES (30-50% savings, major impact):

  1. Remove or externalize CLAUDE.md MCP section
     Current: 1,172 tokens per session
     Option: Host in README.md or external link
     Savings: 1,172 tokens per session (15-20% of typical session)
     Trade-off: Users must reference external docs
     Verdict: NOT RECOMMENDED - CLAUDE.md integration is important

════════════════════════════════════════════════════════════════════════════════
RECOMMENDED OPTIMIZATIONS (Balanced Approach)
════════════════════════════════════════════════════════════════════════════════

EASY + NO IMPACT (Do immediately):

  1. Add recommendations: false option to analyze response
     Code change: Make recommendations conditional at line 928-932
     Savings: 50 tokens per analyze call
     Impact: NONE (recommendations already optional semantically)

  2. Limit dead_code to top 10 items instead of 20
     Code change: Slice arrays at line 1135-1138
     From: slice(0, 20)
     To:   slice(0, 10)
     Savings: ~600 tokens per dead_code call
     Impact: Users may need to run analysis multiple times
     Verdict: ACCEPTABLE for most use cases

GOOD BALANCE (Recommended):

  1. All of "Easy + No Impact" above (650 tokens saved)
  
  2. Limit sym.full edges to 5 instead of 15 per symbol
     Code change: Line 1685 slice(0, 5) instead of slice(0, 15)
     Savings: 67% of sym.full overhead (3,000 tokens max reduction)
     Impact: Users still see top relationships
     Verdict: GOOD - reasonable compromise
  
  3. Truncate duplicate groups to top 10 instead of 20
     Code change: Line 906 slice(0, 10)
     Savings: ~500 tokens per duplicates call
     Impact: Users can re-run with higher results if needed
     Verdict: ACCEPTABLE

  Combined savings: ~1,500 tokens per analyze session (20-25% reduction)
  Combined impact: MINIMAL (users can increase limits if needed)

AGGRESSIVE (Optional, for extreme optimization):

  1. All of "Good Balance" above (1,500 tokens)
  
  2. Remove graph_limitations field from dead_code
     Code change: Lines 1123-1127 - delete the array
     Savings: 150 tokens per dead_code call
     Impact: Users lose analytical context
     Verdict: NOT RECOMMENDED unless critical for token budget
  
  Combined savings: ~1,650 tokens
  Combined impact: MODERATE (users lose useful context)

════════════════════════════════════════════════════════════════════════════════
10. FINAL ASSESSMENT
════════════════════════════════════════════════════════════════════════════════

PROMPT HYGIENE SCORE: 7.5/10 (GOOD with opportunity for optimization)

WHAT'S WORKING WELL:
  ✓ Single sentinel tool eliminates parameter sprawl
  ✓ Nested params organized logically by action type
  ✓ Search results compact by default (full:true opt-in)
  ✓ All responses have hard truncation limits
  ✓ Signature extraction clever (120-char first declaration)
  ✓ Graph traversal bounded (max 50 nodes)
  ✓ Results limits reasonable (10-20 items typical)
  ✓ Relative paths actionable (can pass to view tool)

WHAT NEEDS WORK:
  ⚠️  Analyze responses largest (3,000-4,500 tokens)
  ⚠️  Dead code includes verbose descriptions + recommendations
  ⚠️  graph_limitations warnings valuable but verbose
  ⚠️  sym.full can hit 9,000 tokens with highly-connected symbols
  ⚠️  28 nested parameters create complexity (some actions 10+ params)
  ⚠️  CLAUDE.md MCP section adds 1,172 tokens per session

QUICK WINS (Easy, high-impact):
  1. Add recommendations: false option to analyze
  2. Reduce result arrays from 20 to 10 items
  3. Limit sym.full edges to 5 per symbol

IMPACT OF QUICK WINS:
  Savings: ~1,500 tokens per analyze session
  Usability impact: MINIMAL
  Implementation time: <1 hour

EXAMPLE SESSION BEFORE/AFTER:

  BEFORE:
    Tool schema: 300 tokens
    CLAUDE.md: 1,172 tokens
    Search: 700 tokens
    Sym: 1,900 tokens (with full)
    Analyze dead_code: 4,000 tokens
    ──────────────────
    TOTAL: 8,072 tokens

  AFTER (quick wins):
    Tool schema: 300 tokens
    CLAUDE.md: 1,172 tokens
    Search: 700 tokens
    Sym: 1,200 tokens (5 edges, still with full)
    Analyze dead_code: 3,400 tokens (10 items, no recommendations field)
    ──────────────────
    TOTAL: 6,772 tokens (16% reduction)

════════════════════════════════════════════════════════════════════════════════
SPECIFIC CODE CHANGES RECOMMENDED
════════════════════════════════════════════════════════════════════════════════

1. Line 1685 (sym.full edges):
   FROM: edges.slice(0, 15).map(...)
   TO:   edges.slice(0, 5).map(...)
   EFFECT: Reduce sym.full payload by 67%

2. Lines 906, 936 (duplicate groups):
   FROM: .slice(0, 20)
   TO:   .slice(0, 10)
   EFFECT: Reduce duplicates response by 50%

3. Lines 1135-1138 (dead code arrays):
   FROM: .slice(0, 20)
   TO:   .slice(0, 10)
   EFFECT: Reduce dead_code response by 50%

4. Line 928-932 (recommendations):
   MAKE CONDITIONAL based on new optional parameter
   Add to analyze schema: recommendations: boolean().optional()
   EFFECT: Allow users to opt-out of recommendations field

════════════════════════════════════════════════════════════════════════════════
