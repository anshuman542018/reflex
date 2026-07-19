import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Reflex exposes the complete correction and verification API", async () => {
  const [agent, correct, reflex, reset, engine] = await Promise.all([
    read("app/api/agent/route.ts"),
    read("app/api/correct/route.ts"),
    read("app/api/reflex/route.ts"),
    read("app/api/reset/route.ts"),
    read("lib/reflex-engine.ts"),
  ]);

  assert.match(agent, /runAgent/);
  assert.match(correct, /createCorrection/);
  assert.match(reflex, /text\/event-stream/);
  for (const stage of [
    "diagnosing",
    "rule",
    "writing_eval",
    "eval_before",
    "eval_after",
    "regressions",
    "committing",
    "done",
  ]) {
    assert.match(reflex, new RegExp(`emit\\(\"${stage}\"`));
  }
  assert.match(reset, /resetRepository/);
  assert.match(engine, /text:\s*\{[\s\S]*format:\s*\{[\s\S]*json_schema/);
  assert.match(engine, /failsOnBefore && passesOnAfter && regressions === 0/);
});

test("agent harness implements the four sandbox tools and memory injection", async () => {
  const agent = await read("lib/agent.ts");
  for (const tool of ["list_files", "read_file", "write_file", "run_tests"]) {
    assert.match(agent, new RegExp(`name: \"${tool}\"`));
  }
  assert.match(agent, /AGENTS\.md/);
  assert.match(agent, /previous_response_id/);
  assert.match(agent, /function_call_output/);
  assert.match(agent, /gpt-5\.6-sol|OPENAI_MODEL|getOpenAIModel/);
});
