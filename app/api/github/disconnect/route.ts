import { verifyRequestUser } from "@/lib/auth/session";
import { deleteGithubConnection } from "@/lib/github/client";
import { handleRouteError, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    await deleteGithubConnection(user.uid);
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "github.disconnect");
  }
}
