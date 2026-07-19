import { createCorrection, getRepositoryState } from "../../../lib/repository";
import { RepoFile } from "../../../lib/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      prompt?: string;
      beforeFiles?: RepoFile[];
      afterFiles?: RepoFile[];
    };
    if (!payload.prompt || !payload.beforeFiles?.length || !payload.afterFiles?.length) {
      return Response.json({ error: "Correction data is incomplete." }, { status: 400 });
    }

    const state = await getRepositoryState();
    const result = await createCorrection({
      prompt: payload.prompt,
      beforeFiles: payload.beforeFiles,
      afterFiles: payload.afterFiles,
      context: `AGENTS.md:\n${state.agentsMd}\n\nExisting files:\n${state.files.map((file) => file.path).join("\n")}`,
    });
    return Response.json({ correctionId: result.id }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not capture the correction." },
      { status: 500 },
    );
  }
}
