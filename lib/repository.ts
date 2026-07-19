import { env } from "cloudflare:workers";
import {
  CorrectionRecord,
  EMPTY_AGENTS_MD,
  REPO_NAME,
  RepositoryState,
  RepoFile,
  RuleRecord,
  SEED_FILES,
  sortFiles,
} from "./types";
import { hasOpenAIKey } from "./env";

type StateRow = {
  repo: string;
  files_json: string;
  agents_md: string;
  skill_md: string;
  mistakes_prevented: number;
  sessions: number;
  last_event: string;
  updated_at: string;
};

type CorrectionRow = {
  id: string;
  repo: string;
  prompt: string;
  before_json: string;
  after_json: string;
  context: string;
  status: CorrectionRecord["status"];
  created_at: string;
};

type RuleRow = {
  id: string;
  correction_id: string;
  statement: string;
  rationale: string;
  skill_markdown: string;
  eval_filename: string;
  eval_code: string;
  status: RuleRecord["status"];
  created_at: string;
};

function getD1() {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) {
    throw new Error("The Reflex D1 binding is unavailable.");
  }
  return db;
}

let schemaReady: Promise<void> | undefined;

export function ensureSchema() {
  if (!schemaReady) {
    const db = getD1();
    schemaReady = db
      .batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS repository_state (
          repo TEXT PRIMARY KEY NOT NULL,
          files_json TEXT NOT NULL,
          agents_md TEXT NOT NULL,
          skill_md TEXT NOT NULL DEFAULT '',
          mistakes_prevented INTEGER NOT NULL DEFAULT 0,
          sessions INTEGER NOT NULL DEFAULT 0,
          last_event TEXT NOT NULL DEFAULT 'Seeded demo repository',
          updated_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS corrections (
          id TEXT PRIMARY KEY NOT NULL,
          repo TEXT NOT NULL,
          prompt TEXT NOT NULL,
          before_json TEXT NOT NULL,
          after_json TEXT NOT NULL,
          context TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'captured',
          created_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS rules (
          id TEXT PRIMARY KEY NOT NULL,
          correction_id TEXT NOT NULL,
          statement TEXT NOT NULL,
          rationale TEXT NOT NULL,
          skill_markdown TEXT NOT NULL,
          eval_filename TEXT NOT NULL,
          eval_code TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'verified',
          created_at TEXT NOT NULL
        )`),
        db.prepare("CREATE INDEX IF NOT EXISTS corrections_repo_idx ON corrections (repo, created_at)"),
        db.prepare("CREATE INDEX IF NOT EXISTS rules_correction_idx ON rules (correction_id, created_at)"),
      ])
      .then(() => undefined)
      .catch((error) => {
        schemaReady = undefined;
        throw error;
      });
  }
  return schemaReady;
}

function seedFiles() {
  return SEED_FILES.map((file) => ({ ...file }));
}

async function insertSeed(repo = REPO_NAME) {
  const now = new Date().toISOString();
  await getD1()
    .prepare(`INSERT OR REPLACE INTO repository_state
      (repo, files_json, agents_md, skill_md, mistakes_prevented, sessions, last_event, updated_at)
      VALUES (?, ?, ?, '', 0, 0, 'Seeded demo repository', ?)`)
    .bind(repo, JSON.stringify(seedFiles()), EMPTY_AGENTS_MD, now)
    .run();
}

async function listRules(): Promise<RuleRecord[]> {
  const result = await getD1()
    .prepare("SELECT * FROM rules ORDER BY created_at DESC")
    .all<RuleRow>();

  return result.results.map((row) => ({
    id: row.id,
    correctionId: row.correction_id,
    statement: row.statement,
    rationale: row.rationale,
    skillMarkdown: row.skill_markdown,
    evalFilename: row.eval_filename,
    evalCode: row.eval_code,
    status: row.status,
    createdAt: row.created_at,
  }));
}

function parseState(row: StateRow, rules: RuleRecord[]): RepositoryState {
  return {
    repo: row.repo,
    files: sortFiles(JSON.parse(row.files_json) as RepoFile[]),
    agentsMd: row.agents_md,
    skillMd: row.skill_md,
    mistakesPrevented: row.mistakes_prevented,
    sessions: row.sessions,
    lastEvent: row.last_event,
    updatedAt: row.updated_at,
    rules,
    apiMode: hasOpenAIKey() ? "live" : "showcase",
  };
}

export async function getRepositoryState(repo = REPO_NAME) {
  await ensureSchema();
  let row = await getD1()
    .prepare("SELECT * FROM repository_state WHERE repo = ?")
    .bind(repo)
    .first<StateRow>();

  if (!row) {
    await insertSeed(repo);
    row = await getD1()
      .prepare("SELECT * FROM repository_state WHERE repo = ?")
      .bind(repo)
      .first<StateRow>();
  }

  if (!row) throw new Error("Could not initialize the demo repository.");
  return parseState(row, await listRules());
}

export async function resetRepository(repo = REPO_NAME) {
  await ensureSchema();
  const db = getD1();
  await db.batch([
    db.prepare("DELETE FROM rules"),
    db.prepare("DELETE FROM corrections WHERE repo = ?").bind(repo),
    db.prepare("DELETE FROM repository_state WHERE repo = ?").bind(repo),
  ]);
  await insertSeed(repo);
  return getRepositoryState(repo);
}

export async function createCorrection(input: {
  repo?: string;
  prompt: string;
  beforeFiles: RepoFile[];
  afterFiles: RepoFile[];
  context: string;
}) {
  const repo = input.repo ?? REPO_NAME;
  await ensureSchema();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const state = await getRepositoryState(repo);
  const next = new Map(state.files.map((file) => [file.path, file.content]));
  for (const file of input.afterFiles) next.set(file.path, file.content);
  const nextFiles = sortFiles([...next].map(([path, content]) => ({ path, content })));

  const db = getD1();
  await db.batch([
    db
      .prepare(`INSERT INTO corrections
        (id, repo, prompt, before_json, after_json, context, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'captured', ?)`)
      .bind(
        id,
        repo,
        input.prompt,
        JSON.stringify(input.beforeFiles),
        JSON.stringify(input.afterFiles),
        input.context,
        now,
      ),
    db
      .prepare(`UPDATE repository_state
        SET files_json = ?, last_event = 'Human correction accepted', updated_at = ?
        WHERE repo = ?`)
      .bind(JSON.stringify(nextFiles), now, repo),
  ]);

  return { id };
}

export async function getCorrection(id: string): Promise<CorrectionRecord | null> {
  await ensureSchema();
  const row = await getD1()
    .prepare("SELECT * FROM corrections WHERE id = ?")
    .bind(id)
    .first<CorrectionRow>();

  if (!row) return null;
  return {
    id: row.id,
    repo: row.repo,
    prompt: row.prompt,
    beforeFiles: JSON.parse(row.before_json) as RepoFile[],
    afterFiles: JSON.parse(row.after_json) as RepoFile[],
    context: row.context,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function incrementSessions(repo = REPO_NAME) {
  await ensureSchema();
  await getD1()
    .prepare(`UPDATE repository_state
      SET sessions = sessions + 1, last_event = 'Fresh agent session started', updated_at = ?
      WHERE repo = ?`)
    .bind(new Date().toISOString(), repo)
    .run();
}

export async function commitRule(input: {
  correction: CorrectionRecord;
  statement: string;
  rationale: string;
  skillMarkdown: string;
  evalFilename: string;
  evalCode: string;
}) {
  const { correction } = input;
  const state = await getRepositoryState(correction.repo);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const agentsLine = `- ${input.statement}`;
  const agentsMd = state.agentsMd.includes(agentsLine)
    ? state.agentsMd
    : `${state.agentsMd.trimEnd()}\n${agentsLine}\n`;

  const fileMap = new Map(state.files.map((file) => [file.path, file.content]));
  fileMap.set("AGENTS.md", agentsMd);
  fileMap.set(".codex/skills/repository-conventions/SKILL.md", input.skillMarkdown);
  fileMap.set(input.evalFilename, input.evalCode);
  const files = sortFiles([...fileMap].map(([path, content]) => ({ path, content })));

  const db = getD1();
  await db.batch([
    db
      .prepare(`INSERT INTO rules
        (id, correction_id, statement, rationale, skill_markdown, eval_filename, eval_code, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'committed', ?)`)
      .bind(
        id,
        correction.id,
        input.statement,
        input.rationale,
        input.skillMarkdown,
        input.evalFilename,
        input.evalCode,
        now,
      ),
    db
      .prepare("UPDATE corrections SET status = 'committed' WHERE id = ?")
      .bind(correction.id),
    db
      .prepare(`UPDATE repository_state SET
        files_json = ?, agents_md = ?, skill_md = ?,
        mistakes_prevented = mistakes_prevented + 1,
        last_event = 'Rule verified and committed', updated_at = ?
        WHERE repo = ?`)
      .bind(JSON.stringify(files), agentsMd, input.skillMarkdown, now, correction.repo),
  ]);

  return getRepositoryState(correction.repo);
}
