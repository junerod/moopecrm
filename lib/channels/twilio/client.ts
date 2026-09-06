/**
 * Transporte HTTP da API de mensagens hospedada.
 *
 * POST Messages.json — texto livre (janela 24h) ou ContentSid (template).
 */
import { twilioApiBase, twilioWhatsAppAddress, type TwilioCredentials } from "./credentials";

export async function twilioSendMessage(
  creds: TwilioCredentials,
  input: {
    toDigits: string;
    body?: string;
    contentSid?: string;
    contentVariables?: Record<string, string>;
    statusCallback?: string;
  },
): Promise<{ sid: string | null }> {
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
  const params = new URLSearchParams();
  params.set("From", twilioWhatsAppAddress(creds.fromDigits));
  params.set("To", twilioWhatsAppAddress(input.toDigits));
  if (input.contentSid) {
    params.set("ContentSid", input.contentSid);
    if (input.contentVariables && Object.keys(input.contentVariables).length > 0) {
      params.set("ContentVariables", JSON.stringify(input.contentVariables));
    }
  } else {
    params.set("Body", input.body ?? "");
  }
  if (input.statusCallback) params.set("StatusCallback", input.statusCallback);

  const res = await fetch(
    `${twilioApiBase()}/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  const json = (await res.json().catch(() => null)) as {
    sid?: string;
    message?: string;
    code?: number;
    status?: string;
  } | null;

  if (!res.ok) {
    const detalhe = json?.code
      ? `${json.code}: ${json.message ?? ""}`
      : (json?.message ?? res.statusText);
    throw new Error(`twilio_send_failed: ${res.status} ${detalhe}`.trim());
  }

  return { sid: json?.sid ?? null };
}

export async function twilioAccountHealth(
  creds: TwilioCredentials,
): Promise<{ reachable: boolean; status: string | null; detail: string | null }> {
  try {
    const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
    const res = await fetch(
      `${twilioApiBase()}/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}.json`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (res.status === 401 || res.status === 403) {
      return { reachable: true, status: "FAILED", detail: "credencial recusada" };
    }
    if (!res.ok) {
      return { reachable: true, status: "FAILED", detail: `HTTP ${res.status}` };
    }
    const json = (await res.json().catch(() => null)) as { status?: string } | null;
    const st = (json?.status ?? "").toLowerCase();
    if (st && st !== "active") {
      return { reachable: true, status: "FAILED", detail: st };
    }
    return { reachable: true, status: "WORKING", detail: null };
  } catch (err) {
    return {
      reachable: false,
      status: null,
      detail: err instanceof Error ? err.message : "rede",
    };
  }
}
