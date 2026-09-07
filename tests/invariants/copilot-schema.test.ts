import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { enqueueJob } from "@/lib/agent-engine/queue/queue";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode via `pnpm test:db`");
}

const PORT = Number(process.env.TEST_DB_PORT ?? 54329);
const pool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`,
  max: 2,
});

const ORG = "0be7a70a-0000-4000-8000-0000000000c2";
const CONTACT = "0be7a70a-0000-4000-8000-0000000000c3";

beforeAll(async () => {
  await pool.query(
    `insert into organizations (id, slug, legal_name, display_name)
     values ($1, 'org-copiloto-teste', 'Org Copiloto LTDA', 'Org Copiloto')
     on conflict (id) do nothing`,
    [ORG],
  );
  await pool.query(
    `insert into contacts (id, organization_id, display_name)
     values ($1, $2, 'Lead do Copiloto')
     on conflict (id) do nothing`,
    [CONTACT, ORG],
  );
});

afterAll(async () => {
  await pool.query("delete from ai_copilot_suggestions where organization_id = $1", [ORG]);
  await pool.query("delete from messages where organization_id = $1", [ORG]);
  await pool.query("delete from conversations where organization_id = $1", [ORG]);
  await pool.query("delete from job_queue where organization_id = $1", [ORG]);
  await pool.query("delete from channel_sessions where organization_id = $1", [ORG]);
  await pool.query("delete from contacts where id = $1", [CONTACT]);
  await pool.query("delete from organizations where id = $1", [ORG]);
  await pool.end();
});

describe("schema do copiloto (0202)", () => {
  it("aceita kind copilot_turn com contato", async () => {
    const { job } = await enqueueJob(pool, ORG, {
      leadId: CONTACT,
      kind: "copilot_turn",
      payload: { conversation_id: "0be7a70a-0000-4000-8000-0000000000c4" },
    });
    expect(job.kind).toBe("copilot_turn");
    expect(job.contact_id).toBe(CONTACT);
  });

  it("rejeita copilot_turn sem contato", async () => {
    await expect(
      pool.query(
        `insert into job_queue (organization_id, contact_id, kind, payload) values ($1, null, 'copilot_turn', '{}')`,
        [ORG],
      ),
    ).rejects.toThrow(/job_queue_turn_needs_contact|violates check constraint/i);
  });

  it("as duas tabelas existem com RLS", async () => {
    const { rows } = await pool.query<{ relname: string; rls: boolean }>(
      `select c.relname, c.relrowsecurity as rls
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('ai_copilot_suggestions', 'ai_action_requests')
        order by c.relname`,
    );
    expect(rows.map((r) => r.relname)).toEqual(["ai_action_requests", "ai_copilot_suggestions"]);
    expect(rows.every((r) => r.rls)).toBe(true);
  });

  it("unique (org, conversa, mensagem) impede duas sugestões iguais", async () => {
    const sess = await pool.query<{ id: string }>(
      `insert into channel_sessions (organization_id, waha_session_name, webhook_secret_encrypted)
       values ($1, 'copiloto-uniq', '\\x00'::bytea) returning id`,
      [ORG],
    );
    const conv = await pool.query<{ id: string }>(
      `insert into conversations (organization_id, contact_id, channel_session_id)
       values ($1, $2, $3) returning id`,
      [ORG, CONTACT, sess.rows[0]!.id],
    );
    const msg = await pool.query<{ id: string }>(
      `insert into messages (organization_id, conversation_id, channel_session_id, contact_id, type, direction, body)
       values ($1, $2, $3, $4, 'text', 'inbound', 'uniq') returning id`,
      [ORG, conv.rows[0]!.id, sess.rows[0]!.id, CONTACT],
    );
    await pool.query(
      `insert into ai_copilot_suggestions
         (organization_id, conversation_id, inbound_message_id, summary, intent, suggested_reply, confidence)
       values ($1, $2, $3, 'uma', 'OTHER', 'oi', 0.2)`,
      [ORG, conv.rows[0]!.id, msg.rows[0]!.id],
    );
    await expect(
      pool.query(
        `insert into ai_copilot_suggestions
           (organization_id, conversation_id, inbound_message_id, summary, intent, suggested_reply, confidence)
         values ($1, $2, $3, 'duas', 'OTHER', 'oi', 0.2)`,
        [ORG, conv.rows[0]!.id, msg.rows[0]!.id],
      ),
    ).rejects.toThrow(/ai_copilot_suggestions_msg_unique|duplicate key/i);
  });

  it("índices de org+conversa existem", async () => {
    const { rows } = await pool.query<{ indexname: string }>(
      `select indexname from pg_indexes
        where schemaname = 'public'
          and indexname in ('idx_ai_copilot_suggestions_org_conv', 'idx_ai_action_requests_org_conv',
                            'ai_copilot_suggestions_msg_unique', 'ai_action_requests_key_unique')
        order by indexname`,
    );
    expect(rows.map((r) => r.indexname)).toEqual([
      "ai_action_requests_key_unique",
      "ai_copilot_suggestions_msg_unique",
      "idx_ai_action_requests_org_conv",
      "idx_ai_copilot_suggestions_org_conv",
    ]);
  });
});
