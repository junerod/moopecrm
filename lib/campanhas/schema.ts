import { z } from "zod";

import { OBJETIVOS_DA_CAMPANHA, PRESETS_DE_CONTEUDO, SELECAO_DE_CANAIS } from "@/lib/campanhas/tipos";

export const segmentoSchema = z
  .object({
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
    papel: z.string().max(40).nullable().optional(),
    origem: z.string().max(40).nullable().optional(),
    owner_user_id: z.string().uuid().nullable().optional(),
    pipeline_id: z.string().uuid().nullable().optional(),
    stage_id: z.string().uuid().nullable().optional(),
    temperatura: z.enum(["frio", "morno", "quente"]).nullable().optional(),
    contact_ids: z.array(z.string().uuid()).max(2000).optional(),
  })
  .default({});

export const anexoSchema = z.object({
  storage_path: z.string().min(1).max(400),
  mime: z.string().min(1).max(80),
  size_bytes: z.number().int().nonnegative(),
  filename: z.string().min(1).max(160),
  kind: z.enum(["image", "video", "document"]),
});

export const settingsSchema = z
  .object({
    objective: z.enum(OBJETIVOS_DA_CAMPANHA).nullable().optional(),
    channels: z.enum(SELECAO_DE_CANAIS).optional(),
    attachments: z.array(anexoSchema).max(3).optional(),
    content_preset: z.enum(PRESETS_DE_CONTEUDO).optional(),
    preparing: z.boolean().optional(),
    confirm_all_base: z.boolean().optional(),
    confirm_large: z.boolean().optional(),
    message_template_id: z.string().uuid().nullable().optional(),
    cta_url: z.string().max(500).nullable().optional(),
    cta_label: z.string().max(80).nullable().optional(),
    timezone: z.string().max(80).nullable().optional(),
  })
  .default({});

export const createCampanhaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channel_session_id: z.string().uuid().nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  body_text: z.string().max(2000).default(""),
  segment: segmentoSchema,
  scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
  settings: settingsSchema.optional(),
});

export const patchCampanhaSchema = createCampanhaSchema.partial();
