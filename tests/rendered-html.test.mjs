import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("the production build contains the Reflex product shell", async () => {
  const [serverBundle, clientFiles] = await Promise.all([
    readFile(new URL("../dist/server/index.js", import.meta.url), "utf8"),
    readFile(new URL("../app/ReflexApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(serverBundle, /Reflex — Correct once\. Never again\./);
  assert.match(clientFiles, /Correct once\. Never again\./);
  assert.match(clientFiles, /Patch review/);
  assert.match(clientFiles, /Verified memory/);
  assert.match(clientFiles, /Add \/health/);
  assert.doesNotMatch(serverBundle, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("starter preview is removed and product metadata is committed", async () => {
  const [page, layout, packageJson, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<ReflexApp \/>/);
  assert.match(layout, /Reflex — Correct once\. Never again\./);
  assert.match(layout, /\/og\.png/);
  assert.match(packageJson, /"name": "reflex-agent-memory"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(hosting, /"d1": "DB"/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
