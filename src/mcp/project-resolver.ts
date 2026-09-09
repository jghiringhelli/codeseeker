/**
 * Project resolution — turning a caller's `project` argument into a usable index.
 *
 * This is one concern with one reason to change, and it lives in one place on purpose.
 * It used to be three: `search` called a shared resolver while `sym` and `graph` each
 * carried a private copy that fell back to `process.cwd()`. An MCP server's working
 * directory belongs to whatever launched it, so both actions reported "Project not
 * indexed" for projects `search` resolved without trouble — GitHub issue #2, open for
 * five months. Architecture rule §3 and gate `no-divergent-project-resolution` exist to
 * keep it from splitting again.
 *
 * Resolution has three layers, and they answer different questions:
 *   resolveProject          — which project does this argument mean?
 *   resolveIndexedProject   — …and is it registered? (graph-backed actions need an id)
 *   verifyIndexed           — …and does it actually hold vectors we can search?
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

import { getStorageManager } from '../storage';
import { checkEmbeddingCompatibility } from './embedding-identity';

/** An error already shaped as an MCP tool response. */
export interface ToolError {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
}

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  metadata?: Record<string, unknown>;
}

const err = (text: string): ToolError => ({
  content: [{ type: 'text' as const, text }],
  isError: true,
});

/**
 * Paths that must never be indexed.
 *
 * Indexing reads every file it can reach and writes their content into a searchable
 * store, so pointing it at a credential directory would copy secrets into an index
 * (contract C5).
 */
export const DANGEROUS_PATHS = [
  '/etc', '/var', '/usr', '/bin', '/sbin', '/lib', '/boot', '/root', '/proc', '/sys', '/dev',
  'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\ProgramData',
  '.ssh', '.gnupg', '.aws', '.azure', '.config',
];

/** Reject a path before it is indexed. Returns a reason, or null when acceptable. */
export function validateProjectPath(projectPath: string): string | null {
  const normalizedPath = path.normalize(projectPath);
  if (normalizedPath.includes('..')) {
    return 'Path traversal detected: paths with ".." are not allowed';
  }
  const lowerPath = normalizedPath.toLowerCase();
  for (const dangerous of DANGEROUS_PATHS) {
    const lowerDangerous = dangerous.toLowerCase();
    if (lowerPath === lowerDangerous || lowerPath.startsWith(lowerDangerous + path.sep)) {
      return `Security: cannot index system directory "${dangerous}"`;
    }
  }
  for (const part of normalizedPath.split(path.sep)) {
    const lowerPart = part.toLowerCase();
    if (lowerPart === '.ssh' || lowerPart === '.gnupg' || lowerPart === '.aws') {
      return `Security: cannot index sensitive directory "${part}"`;
    }
  }
  return null;
}

/** Deterministic id for a project path, so re-initialising does not create a duplicate. */
export function generateProjectId(projectPath: string): string {
  return crypto.createHash('md5').update(projectPath).digest('hex');
}

/** Walk up looking for a `.codeseeker` marker, so a nested path resolves to its root. */
export async function findProjectPath(startPath: string): Promise<string> {
  let currentPath = path.resolve(startPath);
  const root = path.parse(currentPath).root;
  while (currentPath !== root) {
    if (fs.existsSync(path.join(currentPath, '.codeseeker', 'project.json'))) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }
  return startPath;
}

export interface ResolvedProject {
  projectPath: string;
  projectRecord?: ProjectRecord;
  error?: ToolError;
}

/**
 * Resolve a `project` argument to a path, and to a registry record when one exists.
 *
 * With no argument and exactly one indexed project, that project is used — the common
 * single-project case should not require ceremony. With several, the caller is asked to
 * choose and shown the options, because guessing would silently search the wrong code.
 */
export async function resolveProject(project?: string): Promise<ResolvedProject> {
  const storageManager = await getStorageManager();
  const projects = await storageManager.getProjectStore().list();

  if (project) {
    const found = projects.find(p =>
      p.name === project ||
      p.path === project ||
      path.basename(p.path) === project ||
      path.resolve(project) === p.path
    );
    if (found) return { projectPath: found.path, projectRecord: found as ProjectRecord };

    // Not a registered name or path — but it may be a *subdirectory* of an indexed
    // project, so walk up for a marker and re-match against the registry. Without the
    // re-match the walk produced a bare path that looked indexed and was not, which let
    // searches run against a non-existent index and answer "No results".
    const walked = await findProjectPath(path.resolve(project));
    const viaWalk = projects.find(p => path.resolve(p.path) === path.resolve(walked));
    if (viaWalk) return { projectPath: viaWalk.path, projectRecord: viaWalk as ProjectRecord };

    return { projectPath: walked };
  }

  if (projects.length === 0) {
    return {
      projectPath: '',
      error: err('No indexed projects. Use index({action: "init", path: "/path/to/project"}) first.'),
    };
  }
  if (projects.length === 1) {
    return { projectPath: projects[0].path, projectRecord: projects[0] as ProjectRecord };
  }

  const projectList = projects.map(p => `  - "${p.name}" (${p.path})`).join('\n');
  return {
    projectPath: '',
    error: err(`Multiple projects indexed. Specify project parameter:\n\n${projectList}`),
  };
}

export interface ResolvedIndexedProject {
  projectId?: string;
  projectPath: string;
  error?: ToolError;
}

/**
 * Resolve to an *indexed record*, for actions backed by the graph store.
 *
 * `resolveProject` may return a bare path for a project it has never indexed, which is
 * fine for path-only callers. `sym` and `graph` need a projectId, so here an unindexed
 * project is an error rather than a silent fall-through.
 */
export async function resolveIndexedProject(project?: string): Promise<ResolvedIndexedProject> {
  const { projectPath, projectRecord, error } = await resolveProject(project);
  if (error) return { projectPath: '', error };
  if (!projectRecord) {
    const hint = projectPath || project || '/path/to/project';
    return {
      projectPath,
      error: err(
        `Project "${project ?? path.basename(hint)}" is not indexed. ` +
        `Run codeseeker({action:"index",index:{op:"init",path:"${hint}"}}) first.`
      ),
    };
  }
  return { projectId: projectRecord.id, projectPath: projectRecord.path };
}

/**
 * Confirm the index is usable before searching it.
 *
 * Two ways it can fail, both of which used to be silent:
 *
 * The registry can hold a project with no chunks. This once probed by searching for the
 * literal token "test" and treating zero hits as proof of absence — a content check
 * standing in for an existence check. The RealWorld Django corpus has 156 embedded
 * chunks and no occurrence of that word, so every search against a perfectly good index
 * was rejected as "not indexed".
 *
 * And the chunks can have been produced by a different embedder. Those vectors share
 * dimensionality and value range with ours, so nothing errors — the ranking is simply
 * wrong. Refusing is the only way that failure becomes visible (R22).
 */
export async function verifyIndexed(
  projectPath: string,
  projectRecord?: ProjectRecord
): Promise<{ error?: ToolError }> {
  if (!projectRecord) {
    return {
      error: err(
        `Project "${path.basename(projectPath) || projectPath}" is not indexed. ` +
        `Run codeseeker({action:"index",index:{op:"init",path:"${projectPath}"}}) first.`
      ),
    };
  }

  const storageManager = await getStorageManager();
  const vectorStore = storageManager.getVectorStore();

  try {
    const chunkCount = await vectorStore.count(projectRecord.id);
    if (!chunkCount) {
      return {
        error: err(
          `Project "${path.basename(projectPath)}" is registered but holds no indexed chunks. ` +
          `Run index({action: "init", path: "${projectPath}"}) first.`
        ),
      };
    }
  } catch {
    return {
      error: err(
        `Project "${path.basename(projectPath)}" needs indexing. ` +
        `Run index({action: "init", path: "${projectPath}"}) first.`
      ),
    };
  }

  const compat = checkEmbeddingCompatibility(projectRecord.metadata);
  if (!compat.compatible) {
    return {
      error: err(
        `${compat.reason}\n\nRebuild the index to continue: ` +
        `codeseeker({action:"index", index:{op:"init", path:"${projectPath}"}})`
      ),
    };
  }

  return {};
}
