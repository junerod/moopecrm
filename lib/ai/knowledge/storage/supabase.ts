import { createAdminClient } from "@/lib/supabase/admin";
import { DocumentExtractError } from "@/lib/ai/knowledge/erros-documentais";
import { chavePertenceAOrg } from "@/lib/ai/knowledge/storage/caminho";
import type { DocumentStorage } from "@/lib/ai/knowledge/storage/tipos";

const BUCKET = "ai-policy";

export function supabaseDocumentStorage(): DocumentStorage {
  return {
    provider: "supabase",
    async put({ organizationId, key, body, contentType }) {
      if (!chavePertenceAOrg(key, organizationId)) {
        throw new DocumentExtractError("storage_failed", "Path fora do prefixo da organização.");
      }
      const admin = createAdminClient();
      const { error } = await admin.storage.from(BUCKET).upload(key, body, {
        contentType,
        upsert: false,
      });
      if (error) {
        throw new DocumentExtractError("storage_failed", error.message);
      }
    },
    async get({ organizationId, key }) {
      if (!chavePertenceAOrg(key, organizationId)) {
        throw new DocumentExtractError("storage_failed", "Path fora do prefixo da organização.");
      }
      const admin = createAdminClient();
      const { data, error } = await admin.storage.from(BUCKET).download(key);
      if (error || !data) {
        throw new DocumentExtractError(
          "storage_failed",
          error?.message ?? "Arquivo não encontrado no storage.",
        );
      }
      return Buffer.from(await data.arrayBuffer());
    },
    async delete({ organizationId, key }) {
      if (!chavePertenceAOrg(key, organizationId)) return;
      const admin = createAdminClient();
      const { error } = await admin.storage.from(BUCKET).remove([key]);
      if (error) {
        throw new DocumentExtractError("storage_failed", error.message);
      }
    },
    async exists({ organizationId, key }) {
      if (!chavePertenceAOrg(key, organizationId)) return false;
      const admin = createAdminClient();
      const pasta = key.split("/").slice(0, -1).join("/");
      const nome = key.split("/").pop();
      const { data, error } = await admin.storage.from(BUCKET).list(pasta, { search: nome });
      if (error) return false;
      return (data ?? []).some((o) => o.name === nome);
    },
  };
}
