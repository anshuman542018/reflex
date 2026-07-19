import { commitRule, getCorrection } from "../../../lib/repository";
import { diagnoseCorrection, verifyCorrection } from "../../../lib/reflex-engine";

export const dynamic = "force-dynamic";

const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function GET(request: Request) {
  const correctionId = new URL(request.url).searchParams.get("correctionId");
  if (!correctionId) {
    return Response.json({ error: "correctionId is required." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (stage: string, detail: unknown = null) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage, detail })}\n\n`));
      };

      try {
        const correction = await getCorrection(correctionId);
        if (!correction) {
          emit("error", "Correction not found");
          controller.close();
          return;
        }

        emit("diagnosing", "Reading the human correction and repository context");
        const diagnosis = await diagnoseCorrection(correction);
        await pause(700);

        if (!diagnosis.output.is_generalizable) {
          emit("skipped", diagnosis.output.rationale);
          controller.close();
          return;
        }

        emit("rule", {
          statement: diagnosis.output.rule_statement,
          rationale: diagnosis.output.rationale,
          mode: diagnosis.mode,
        });
        await pause(850);

        emit("writing_eval", {
          filename: diagnosis.output.regression_eval.filename,
          explanation: diagnosis.output.regression_eval.explanation,
        });
        await pause(750);

        const verification = verifyCorrection(correction, diagnosis.output);
        emit("eval_before", verification.failsOnBefore ? "correctly_failed" : "unexpected_pass");
        await pause(650);
        emit("eval_after", verification.passesOnAfter ? "passed" : "failed");
        await pause(650);
        emit("regressions", {
          count: verification.regressions,
          baselineTests: verification.baselineTests,
        });
        await pause(650);

        if (!verification.verified) {
          emit("verification_failed", verification);
          controller.close();
          return;
        }

        emit("committing", "Writing AGENTS.md, Codex Skill, and regression eval");
        const state = await commitRule({
          correction,
          statement: diagnosis.output.rule_statement,
          rationale: diagnosis.output.rationale,
          skillMarkdown: diagnosis.output.skill_markdown,
          evalFilename: diagnosis.output.regression_eval.filename,
          evalCode: diagnosis.output.regression_eval.code,
        });
        await pause(700);
        emit("done", { state, verification, mode: diagnosis.mode });
      } catch (error) {
        emit("error", error instanceof Error ? error.message : "The Reflex loop failed.");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
