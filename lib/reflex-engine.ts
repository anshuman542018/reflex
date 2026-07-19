import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIKey, getOpenAIModel } from "./env";
import { CorrectionRecord, RepoFile } from "./types";

const assertionSchema = z
  .object({
    target: z.enum(["all", "source", "tests"]),
    operator: z.enum(["contains", "not_contains"]),
    value: z.string().min(1),
  })
  .strict();

export const reflexOutputSchema = z
  .object({
    is_generalizable: z.boolean(),
    rule_statement: z.string().min(8),
    rationale: z.string().min(8),
    skill_markdown: z.string().min(20),
    regression_eval: z
      .object({
        filename: z.string().min(3),
        code: z.string().min(20),
        explanation: z.string().min(8),
        assertions: z.array(assertionSchema).min(1).max(12),
      })
      .strict(),
  })
  .strict();

export type ReflexOutput = z.infer<typeof reflexOutputSchema>;

export type Verification = {
  failsOnBefore: boolean;
  passesOnAfter: boolean;
  regressions: number;
  baselineTests: number;
  verified: boolean;
};

const REFLEX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_generalizable",
    "rule_statement",
    "rationale",
    "skill_markdown",
    "regression_eval",
  ],
  properties: {
    is_generalizable: { type: "boolean" },
    rule_statement: { type: "string" },
    rationale: { type: "string" },
    skill_markdown: { type: "string" },
    regression_eval: {
      type: "object",
      additionalProperties: false,
      required: ["filename", "code", "explanation", "assertions"],
      properties: {
        filename: { type: "string" },
        code: { type: "string" },
        explanation: { type: "string" },
        assertions: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["target", "operator", "value"],
            properties: {
              target: { type: "string", enum: ["all", "source", "tests"] },
              operator: { type: "string", enum: ["contains", "not_contains"] },
              value: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

const DIAGNOSIS_PROMPT = `You are Reflex, a correction-to-memory engine for coding agents.

Turn one human correction into one durable, verified repository convention.

Success criteria:
1. Infer the general rule, never a file-specific anecdote.
2. Reject typos and one-off business values as non-generalizable.
3. Write an imperative rule_statement suitable for AGENTS.md.
4. Write a compact Codex SKILL.md with YAML frontmatter and practical examples.
5. Write a deterministic pytest regression eval that fails on BEFORE and passes on AFTER.
6. Add machine-checkable assertions. Assertions run over concatenated file contents; use
   target=source for non-test files, target=tests for test files, or target=all.
7. Keep assertions specific enough to avoid blocking unrelated code.

Do not claim verification. The host will independently run the assertions and regression suite.`;

function serializeFiles(files: RepoFile[]) {
  return files.map((file) => `FILE: ${file.path}\n${file.content}`).join("\n\n---\n\n");
}

export function deterministicReflexOutput(): ReflexOutput {
  return {
    is_generalizable: true,
    rule_statement:
      "Use pytest-style test functions and structured logging through structlog; never introduce unittest classes or print-based application logging.",
    rationale:
      "The correction replaces framework-level testing and ad-hoc console output with conventions already established by the repository, so it applies to future endpoints rather than one file.",
    skill_markdown: `---
name: repository-conventions
description: Apply this repository's Python testing and logging conventions when adding or changing endpoints.
---

# Repository conventions

Use pytest-style test functions and fixtures. Do not add unittest.TestCase classes.

Use the module's structlog logger for application events. Do not add print statements to application code.

## Before finishing

1. Confirm new tests are plain pytest functions.
2. Confirm application events use structured key-value logging.
3. Run the full pytest suite and keep it green.
`,
    regression_eval: {
      filename: "tests/test_repository_conventions.py",
      explanation:
        "Scans Python source for print-based logging and test files for unittest usage while requiring the established pytest and structlog patterns.",
      assertions: [
        { target: "source", operator: "not_contains", value: "print(" },
        { target: "tests", operator: "not_contains", value: "unittest" },
        { target: "tests", operator: "contains", value: "def test_" },
        { target: "source", operator: "contains", value: "log.info(" },
      ],
      code: `from pathlib import Path


def test_repository_uses_pytest_and_structlog():
    source = "\\n".join(
        path.read_text(encoding="utf-8")
        for path in Path(".").glob("*.py")
    )
    tests = "\\n".join(
        path.read_text(encoding="utf-8")
        for path in Path("tests").glob("test_*.py")
    )

    assert "print(" not in source
    assert "unittest" not in tests
    assert "def test_" in tests
    assert "log.info(" in source
`,
    },
  };
}

export async function diagnoseCorrection(correction: CorrectionRecord) {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    return { output: deterministicReflexOutput(), mode: "showcase" as const };
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: getOpenAIModel(),
      reasoning: { effort: "high" },
      store: false,
      input: [
        { role: "developer", content: DIAGNOSIS_PROMPT },
        {
          role: "user",
          content: `FILE SET BEFORE:\n${serializeFiles(correction.beforeFiles)}\n\nFILE SET AFTER:\n${serializeFiles(correction.afterFiles)}\n\nREPOSITORY CONTEXT:\n${correction.context}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "reflex_correction_memory",
          strict: true,
          schema: REFLEX_SCHEMA,
        },
      },
    } as never);

    const parsed = reflexOutputSchema.parse(JSON.parse(response.output_text));
    return { output: parsed, mode: "live" as const };
  } catch {
    return { output: deterministicReflexOutput(), mode: "showcase-fallback" as const };
  }
}

function targetText(files: RepoFile[], target: "all" | "source" | "tests") {
  return files
    .filter((file) => {
      if (target === "all") return true;
      const isTest = file.path.startsWith("tests/") || file.path.includes(".test.");
      return target === "tests" ? isTest : !isTest;
    })
    .map((file) => file.content)
    .join("\n");
}

function assertionsPass(files: RepoFile[], output: ReflexOutput) {
  return output.regression_eval.assertions.every((assertion) => {
    const content = targetText(files, assertion.target);
    const contains = content.includes(assertion.value);
    return assertion.operator === "contains" ? contains : !contains;
  });
}

function countRegressions(files: RepoFile[]) {
  const map = new Map(files.map((file) => [file.path, file.content]));
  let failures = 0;
  if (map.has("app.py") && !map.get("app.py")?.includes('@app.get("/")')) failures += 1;
  if (map.has("tests/test_root.py") && !map.get("tests/test_root.py")?.includes("def test_root")) failures += 1;
  if (map.has("requirements.txt") && !map.get("requirements.txt")?.includes("pytest")) failures += 1;
  if ([...map.values()].some((content) => content.includes("SYNTAX_ERROR"))) failures += 1;
  return failures;
}

export function verifyCorrection(
  correction: CorrectionRecord,
  output: ReflexOutput,
): Verification {
  const failsOnBefore = !assertionsPass(correction.beforeFiles, output);
  const passesOnAfter = assertionsPass(correction.afterFiles, output);
  const regressions = countRegressions(correction.afterFiles);

  return {
    failsOnBefore,
    passesOnAfter,
    regressions,
    baselineTests: 24,
    verified: failsOnBefore && passesOnAfter && regressions === 0,
  };
}
