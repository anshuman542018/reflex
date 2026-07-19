# OpenAI Build Week submission package

## Core fields

**Project name:** Reflex

**Tagline:** Correct once. Never again.

**Track:** Developer tools

**One-liner:** Reflex turns one coding-agent correction into a verified regression eval, a permanent `AGENTS.md` rule, and a reusable Codex Skill so the mistake is not repeated in a fresh session.

**Live demo:** https://reflex-agent-memory.rajeevpandeylko-rp.chatgpt.site

**Code repository:** https://github.com/anshuman542018/reflex

**Public YouTube demo:** `TO_BE_ADDED_AFTER_VIDEO_UPLOAD`

**Primary Codex /feedback Session ID:** `TO_BE_ADDED_FROM_PRIMARY_BUILD_TASK`

## Project description

Coding agents are good at code and bad at remembering your corrections. The same class of mistake returns in a new session because the lesson lived only in conversation history.

Reflex turns a correction into repository-owned, executable memory. When a developer edits an agent's patch, Reflex captures the original code, the accepted version, and repository context. GPT-5.6 Sol diagnoses the general rule behind the change and produces a strict structured payload: an imperative rule, rationale, reusable Codex Skill, regression eval, and machine-checkable assertions.

The model does not get to declare success. Reflex independently verifies that the generated eval fails on the agent's bad patch, passes on the human correction, and introduces zero regressions against the 24-test baseline. Only then does it commit the rule to `AGENTS.md`, write `.codex/skills/repository-conventions/SKILL.md`, persist the eval, and update the prevention metric.

The final proof is a fresh agent session with no previous response state. It reads only the repository memory and produces the next endpoint with pytest and structlog on its first attempt. One correction becomes a portable rule that humans, Codex, other coding agents, and CI can all use.

## How it works

1. A four-tool coding-agent harness works over a D1-backed virtual repository.
2. The developer reviews and edits the proposed patch.
3. `/api/correct` persists the `BEFORE`, `AFTER`, and repository context.
4. `/api/reflex` streams eight verification stages through Server-Sent Events.
5. GPT-5.6 Sol returns a strict Structured Output for the rule, Skill, and eval.
6. The host independently runs fail-before, pass-after, and regression gates.
7. Verified memory is committed to repository files and the learning ledger.
8. A fresh-session agent turn demonstrates that the learned convention changes future output.

## How Codex and GPT-5.6 were used

Codex was the primary build environment from blueprint to deployed product. It recovered and interpreted the source blueprint, checked current OpenAI documentation, made the hosted-sandbox architecture decision, implemented the full stack, designed the UI, wrote the tests, exercised the end-to-end flow, and prepared the submission.

GPT-5.6 Sol is integrated twice in the runtime:

- **Coding-agent harness:** Responses API function tools (`list_files`, `read_file`, `write_file`, `run_tests`), `previous_response_id`, and persistent reasoning context for fresh agent sessions.
- **Reflex Engine:** high-reasoning correction diagnosis with strict Structured Outputs for the generalized rule, Skill, regression eval, and assertions.

The opening mistake stays deterministic for a reliable public demo; with `OPENAI_API_KEY` configured, live GPT-5.6 powers diagnosis and learned fresh-session turns. The interface clearly labels the active runtime mode.

## What makes it different

Rules files require humans to author the rule. Eval products require humans to author the test. Reflex autonomously creates both from the correction and proves the generated eval before the rule is allowed into memory.

The moat is the verified loop:

```text
human correction → generalized rule → self-written eval
→ fails on old code → passes on fix → zero regressions
→ AGENTS.md + Codex Skill
```

## Judge test instructions

No account, API key, or rebuild is required for the hosted demo.

1. Open the live URL.
2. Click **Run “Add /health”**.
3. Click **Correct once**.
4. Click **Accept with correction** and watch all verification stages.
5. Click **Start fresh session**.
6. Confirm the `/version` patch uses pytest + structlog on the first attempt.
7. Open **Memory** and inspect the committed rule, Skill, and eval.
8. Use the reset icon to repeat the exact demo.

## 100-second demo video script

**0:00–0:09 — Problem**

> Coding agents remember the conversation, not your standards. Start a new session and the same mistake comes back. Reflex turns one correction into verified repository memory.

Show the clean `AGENTS.md`, zero prevented mistakes, and the empty timeline.

**0:09–0:25 — The mistake**

> I ask the agent for a health endpoint and a test. It chooses `unittest` and `print`, but this repository uses pytest and structlog.

Run the `/health` prompt and show the patch.

**0:25–0:36 — Correct once**

> I correct it once. This is the only manual teaching step.

Click **Correct once**, briefly show the edited code, then **Accept with correction**.

**0:36–1:02 — Reflex loop**

> GPT-5.6 Sol diagnoses the general convention and writes a regression eval. The model cannot approve its own answer: Reflex proves the eval fails on the bad code, passes on my fix, and keeps all 24 baseline tests green. Only then does it commit the rule.

Let the full timeline animate. Open Memory and flash `AGENTS.md`, the Codex Skill, and the eval.

**1:02–1:22 — Falsifiable proof**

> Now I clear the conversation and start a completely fresh agent session. There is no previous response state — only the repository memory Reflex wrote.

Click **Start fresh session** and show the `/version` patch.

> First try: pytest, structlog, and the convention eval passes. One correction prevented the next mistake.

**1:22–1:36 — Build details**

> Codex helped me turn the blueprint into this complete product: the D1 data model, streamed verification engine, safe virtual sandbox, responsive interface, tests, and deployment. GPT-5.6 Sol powers both the coding-agent tool loop and the structured correction diagnosis.

Briefly show the architecture section of the README or a split view with the code.

**1:36–1:40 — Close**

> Reflex. Correct once. Never again.

End on the mistakes-prevented counter and social card.

## YouTube metadata

**Title:** Reflex — Verified memory for coding agents | OpenAI Build Week 2026

**Description:**

> Reflex turns one coding-agent correction into a verified regression eval, a permanent AGENTS.md rule, and a reusable Codex Skill. Built with Codex and GPT-5.6 Sol for OpenAI Build Week 2026 — Developer Tools track. Live demo and source links below.

**Thumbnail line:** Correct once. Never again.

## What comes next

- A GitHub App that turns PR review corrections into candidate rules.
- Ephemeral container execution with network disabled and resource limits.
- Rule deduplication, contradiction detection, and clustered team Skills.
- Eval flakiness detection and confidence scoring.
- Shared organizational memory with repository-level approval gates.
- Prevention telemetry based on caught violations rather than commit count.

## Submission checklist

- [x] Add the deployed live URL.
- [x] Publish the repository and add its URL.
- [x] Add the MIT license and verify no secrets are tracked.
- [ ] Record the working product with English voiceover, under 3 minutes.
- [ ] Upload the demo publicly to YouTube and add its URL.
- [ ] Run `/feedback` in the primary Codex build task and add the Session ID.
- [ ] Choose **Developer tools**.
- [ ] Confirm eligibility and accept the official rules personally.
- [ ] Save a Devpost draft before final submission.
- [ ] Re-run the hosted demo from reset immediately before submitting.
