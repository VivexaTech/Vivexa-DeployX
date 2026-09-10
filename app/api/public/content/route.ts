import {
  getActivePlans,
  getCompanyContent,
  getShowcaseProjects,
  getSupportContent,
} from "@/lib/content/public";
import { handleRouteError, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [plans, projects, support, company] = await Promise.all([
      getActivePlans(),
      getShowcaseProjects(),
      getSupportContent(),
      getCompanyContent(),
    ]);
    return json({ plans, projects, support, company });
  } catch (error) {
    return handleRouteError(error, "public.content");
  }
}
