import { env } from "@/lib/env";

export type AssessorCall = {
  ok: boolean;
  error?: string;
  results?: Array<{ phone: string; ok: boolean; error?: string }>;
};

/**
 * Fala com o Meu Assessor (whitelist ou aviso). Segredo fica no servidor.
 */
export async function chamarAssessor(body: Record<string, unknown>): Promise<AssessorCall> {
  const secret = env.ASSESSOR_PARTNER_SECRET.trim();
  const base = env.ASSESSOR_BASE_URL.replace(/\/$/, "");
  if (!secret) return { ok: false, error: "secret_missing" };

  const res = await fetch(`${base}/api/partner/deskcomm/alert`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-assessor-moope-secret": secret,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
    results?: Array<{ phone: string; ok: boolean; error?: string }>;
  };
  if (!res.ok || json.ok === false) {
    return { ok: false, error: json.error || `http_${res.status}`, results: json.results };
  }
  return { ok: true, results: json.results };
}
