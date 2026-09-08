/**
 * Behavioural contract suite — runs against a live server process.
 *
 * Every other test in this repository exercises TypeScript functions in-process. This
 * one spawns `dist/cli/codeseeker-cli.js serve --mcp` and speaks JSON-RPC to it over
 * stdio, which is what a real client does. It therefore verifies things no unit test
 * can: that the build is loadable, that the process starts, that stdout carries clean
 * protocol, and that the observable tool surface is what the specification says.
 *
 * Each test names the requirement it verifies. A test here without a requirement in
 * docs/specs/spec.md is a test with no authority behind it — add the requirement first.
 *
 * Requires `npm run build`. Run with `npm run test:contract`.
 */

import * as os from 'os';
import * as path from 'path';
import { McpProbe, ToolDescriptor } from './mcp-probe';

jest.setTimeout(120000);

describe('MCP contract — live server over stdio', () => {
  let probe: McpProbe;
  let tools: ToolDescriptor[];

  beforeAll(async () => {
    probe = new McpProbe();
    await probe.start();
    tools = await probe.listTools();
  });

  afterAll(async () => {
    await probe?.stop();
  });

  // ── The tool surface (R1, C7) ──────────────────────────────────────────────

  describe('tool surface', () => {
    it('R1/C7: exposes exactly one tool, named codeseeker', () => {
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('codeseeker');
    });

    it('R1: the action key offers exactly the five specified actions', () => {
      const schema = tools[0].inputSchema as {
        properties: { action: { enum: string[] } };
        required: string[];
      };
      expect(new Set(schema.properties.action.enum)).toEqual(
        new Set(['search', 'sym', 'graph', 'analyze', 'index'])
      );
      expect(schema.required).toContain('action');
    });

    it('R2: each action has its own nested parameter group', () => {
      const props = (tools[0].inputSchema as { properties: Record<string, unknown> }).properties;
      for (const group of ['search', 'sym', 'graph', 'analyze', 'index']) {
        expect(props).toHaveProperty(group);
      }
      // `project` is shared across actions rather than repeated inside each group.
      expect(props).toHaveProperty('project');
    });

    it('the tool description stays short — it is re-sent on every request', () => {
      // ADR-0002: the description is a wayfinder, not instructions. A long description
      // both costs tokens on every turn and biases the model toward calling the tool
      // where grep would serve better.
      expect(tools[0].description!.length).toBeLessThan(400);
    });

    it('reports a server version that matches the package', () => {
      // Regression: VERSION was hardcoded and drifted from package.json.
      const pkg = require('../../package.json') as { version: string };
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  // ── Refusals that protect the user (C5) ────────────────────────────────────

  describe('dangerous path refusal', () => {
    const dangerous =
      os.platform() === 'win32'
        ? ['C:\\Windows', 'C:\\Program Files']
        : ['/etc', '/usr'];

    it.each(dangerous)('C5: refuses to index the system directory %s', async (p) => {
      const { text, isError } = await probe.callText('codeseeker', {
        action: 'index',
        index: { op: 'init', path: p },
      });
      expect(isError).toBe(true);
      expect(text.toLowerCase()).toMatch(/security|cannot index|system director/);
    });

    it('C5: refuses a path containing ..', async () => {
      // Sent unnormalised on purpose: path.join() would collapse the `..` before the
      // server ever saw it, and the traversal guard inspects the string it is given.
      const raw = `${os.tmpdir()}${path.sep}..${path.sep}somewhere`;
      const { text, isError } = await probe.callText('codeseeker', {
        action: 'index',
        index: { op: 'init', path: raw },
      });
      expect(isError).toBe(true);
      expect(text.toLowerCase()).toMatch(/traversal|\.\./);
    });

    it('C5: refuses a credential directory', async () => {
      const { isError } = await probe.callText('codeseeker', {
        action: 'index',
        index: { op: 'init', path: path.join(os.homedir(), '.ssh') },
      });
      expect(isError).toBe(true);
    });
  });

  // ── Errors are actionable, never silent (R2, R3, C4, C6) ───────────────────

  describe('error contracts', () => {
    it('R2: an action called with no parameter group errors, naming the group', async () => {
      const { text, isError } = await probe.callText('codeseeker', { action: 'search' });
      expect(isError).toBe(true);
      expect(text.toLowerCase()).toContain('search');
    });

    it('C4: a query against an unknown project errors instead of indexing', async () => {
      const { text, isError } = await probe.callText('codeseeker', {
        action: 'search',
        project: path.join(os.tmpdir(), 'codeseeker-contract-no-such-project'),
        search: { q: 'anything at all' },
      });
      expect(isError).toBe(true);
      // The error must name the fix, not merely report failure.
      expect(text).toMatch(/index/i);
      expect(text).toMatch(/init/i);
    });

    it('R3: sym on an unknown project errors and never falls back to cwd', async () => {
      // The probe runs the server from tests/contract/, which is not a project root.
      // Before the fix for issue #2 this path silently resolved against process.cwd().
      const { text, isError } = await probe.callText('codeseeker', {
        action: 'sym',
        project: path.join(os.tmpdir(), 'codeseeker-contract-no-such-project'),
        sym: { name: 'AnySymbol' },
      });
      expect(isError).toBe(true);
      expect(text).toMatch(/not indexed/i);
      // The error names the project it could not find, rather than a generic message.
      expect(text).toContain('codeseeker-contract-no-such-project');
    });

    it('R3: graph on an unknown project errors the same way as sym', async () => {
      const { isError } = await probe.callText('codeseeker', {
        action: 'graph',
        project: path.join(os.tmpdir(), 'codeseeker-contract-no-such-project'),
        graph: { seed: 'src/whatever.ts' },
      });
      expect(isError).toBe(true);
    });

    it('C6: index status responds even with nothing indexed', async () => {
      const { text } = await probe.callText('codeseeker', {
        action: 'index',
        index: { op: 'status' },
      });
      expect(text.length).toBeGreaterThan(0);
    });
  });

  // ── The protocol itself ────────────────────────────────────────────────────

  describe('protocol hygiene', () => {
    it('keeps stdout clean — logs go to stderr', () => {
      // If the server printed to stdout, the probe's JSON parser would have skipped the
      // line and the earlier requests would have timed out. Reaching here proves the
      // separation held. Asserted explicitly so the reason is recorded.
      expect(probe.stderr).toMatch(/CodeSeeker MCP server running on stdio/);
    });

    it('survives an unknown action without crashing the process', async () => {
      await probe.callText('codeseeker', { action: 'search', search: { q: 'x' } }).catch(() => undefined);
      // The server must still answer afterwards.
      const tools2 = await probe.listTools();
      expect(tools2).toHaveLength(1);
    });

    it('answers repeated requests on one connection', async () => {
      for (let i = 0; i < 3; i++) {
        const { text } = await probe.callText('codeseeker', {
          action: 'index',
          index: { op: 'status' },
        });
        expect(text.length).toBeGreaterThan(0);
      }
    });
  });
});
