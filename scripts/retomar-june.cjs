/* Retoma o agente na conversa da June (handoff silenciou o bot). */
const { createClient } = require("@supabase/supabase-js");

const ORG = "9a9ef4ee-1eb2-42ab-a969-9787a63c9d68";
const CONV = "32669d69-41b8-438e-89db-e665e214d889";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NO-GO sem supabase");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: conv, error } = await sb
    .from("conversations")
    .select("id, contact_id, status, assignee_kind, bot_silenced_until")
    .eq("id", CONV)
    .eq("organization_id", ORG)
    .maybeSingle();
  if (error || !conv) {
    console.error("NO-GO conversa", error?.message);
    process.exit(1);
  }
  const contactId = conv.contact_id;
  if (contactId) {
    const { error: e1 } = await sb
      .from("contacts")
      .update({ force_human: false })
      .eq("id", contactId)
      .eq("organization_id", ORG);
    if (e1) {
      console.error("NO-GO contact", e1.message);
      process.exit(1);
    }
  }
  const { error: e2 } = await sb
    .from("conversations")
    .update({
      bot_silenced_until: null,
      assignee_kind: "ai",
      assigned_to_user_id: null,
      status: "open",
    })
    .eq("id", CONV)
    .eq("organization_id", ORG);
  if (e2) {
    console.error("NO-GO conv", e2.message);
    process.exit(1);
  }
  console.log("GO agente retomado na June", { contactId, status: conv.status });
}

main().catch((e) => {
  console.error("NO-GO", e.message);
  process.exit(1);
});
