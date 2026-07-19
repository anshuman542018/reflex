export type RepoFile = {
  path: string;
  content: string;
};

export type RuleRecord = {
  id: string;
  correctionId: string;
  statement: string;
  rationale: string;
  skillMarkdown: string;
  evalFilename: string;
  evalCode: string;
  status: "verified" | "committed" | "rejected";
  createdAt: string;
};

export type RepositoryState = {
  repo: string;
  files: RepoFile[];
  agentsMd: string;
  skillMd: string;
  mistakesPrevented: number;
  sessions: number;
  lastEvent: string;
  updatedAt: string;
  rules: RuleRecord[];
  apiMode: "live" | "showcase";
};

export type CorrectionRecord = {
  id: string;
  repo: string;
  prompt: string;
  beforeFiles: RepoFile[];
  afterFiles: RepoFile[];
  context: string;
  status: "captured" | "verified" | "committed" | "rejected";
  createdAt: string;
};

export type AgentProposal = {
  responseId?: string;
  explanation: string;
  summary: string;
  files: RepoFile[];
  beforeFiles: RepoFile[];
  testSummary: string;
  mode: "live" | "showcase" | "showcase-fallback";
  memoryApplied: boolean;
};

export const REPO_NAME = "demo";

export const EMPTY_AGENTS_MD = `# AGENTS.md

## Conventions
`;

export const SEED_FILES: RepoFile[] = [
  {
    path: "app.py",
    content: `from fastapi import FastAPI
import structlog

log = structlog.get_logger()
app = FastAPI()


@app.get("/")
def root():
    log.info("root_called")
    return {"ok": True}
`,
  },
  {
    path: "tests/test_root.py",
    content: `import pytest
from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


@pytest.mark.parametrize("case", range(23))
def test_root_is_stable(case):
    assert client.get("/").status_code == 200
`,
  },
  {
    path: "requirements.txt",
    content: "fastapi==0.115.8\nhttpx==0.28.1\npytest==8.3.4\nstructlog==25.1.0\n",
  },
  {
    path: "AGENTS.md",
    content: EMPTY_AGENTS_MD,
  },
];

export function filesToMap(files: RepoFile[]) {
  return new Map(files.map((file) => [file.path, file.content]));
}

export function sortFiles(files: RepoFile[]) {
  return [...files].sort((a, b) => a.path.localeCompare(b.path));
}
