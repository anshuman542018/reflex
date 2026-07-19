import { runAgent } from "../../../lib/agent";
import { getRepositoryState, incrementSessions } from "../../../lib/repository";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { prompt?: string; freshSession?: boolean };
    const prompt = payload.prompt?.trim();
    if (!prompt) return Response.json({ error: "A prompt is required." }, { status: 400 });

    if (payload.freshSession) await incrementSessions();
    const state = await getRepositoryState();
    const proposal = await runAgent(state, prompt);
    return Response.json({ proposal });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The agent could not complete the turn." },
      { status: 500 },
    );
  }
}
