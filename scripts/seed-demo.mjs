import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("sandbox-repos/demo");

const files = {
  "app.py": `from fastapi import FastAPI
import structlog

log = structlog.get_logger()
app = FastAPI()


@app.get("/")
def root():
    log.info("root_called")
    return {"ok": True}
`,
  "tests/test_root.py": `import pytest
from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_root():
    assert client.get("/").status_code == 200


@pytest.mark.parametrize("case", range(23))
def test_root_is_stable(case):
    assert client.get("/").status_code == 200
`,
  "AGENTS.md": "# AGENTS.md\n\n## Conventions\n",
  "requirements.txt": "fastapi==0.115.8\nhttpx==0.28.1\npytest==8.3.4\nstructlog==25.1.0\n",
};

for (const [path, content] of Object.entries(files)) {
  const target = resolve(root, path);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, content, "utf8");
}

console.log("Seeded sandbox-repos/demo with the deterministic 24-test repository.");
