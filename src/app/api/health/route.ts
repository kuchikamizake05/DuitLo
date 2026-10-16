import { getReadiness } from "@/server/observability";
import { noStoreJson } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("ready") !== "1") return noStoreJson({status: "alive"}, 200);
  const readiness = await getReadiness();
  return noStoreJson({...readiness, status: readiness.ready ? "ready" : "unavailable"}, readiness.ready ? 200 : 503);
}
