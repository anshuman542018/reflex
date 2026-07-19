import { resetRepository } from "../../../lib/repository";

export async function POST() {
  try {
    return Response.json({ state: await resetRepository() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not reset the demo." },
      { status: 500 },
    );
  }
}
