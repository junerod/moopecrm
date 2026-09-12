/**
 * GET /api/v1/conversations/queue-status
 *
 * Expõe `getQueueStatus` — a mesma conta do MCP e do routing-worker.
 * Org do cookie/JWT, nunca do body. O client do request herda a RLS.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { getQueueStatus } from "@/lib/routing/queue";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const { org } = authz;

  const supabase = await createClient();
  const status = await getQueueStatus(supabase, org.orgId, new Date());
  return ok(status, { requestId });
}
