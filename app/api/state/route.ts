import { getRepositoryState } from "../../../lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getRepositoryState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load Reflex state." },
      { status: 500 },
    );
  }
}
