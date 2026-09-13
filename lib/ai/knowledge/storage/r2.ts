/**
 * Cloudflare R2 via S3-compatible API. Credenciais só no servidor.
 * Bucket dedicado do Knowledge — nunca o do Finance.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "@/lib/env";
import { DocumentExtractError } from "@/lib/ai/knowledge/erros-documentais";
import { chavePertenceAOrg } from "@/lib/ai/knowledge/storage/caminho";
import type { DocumentStorage } from "@/lib/ai/knowledge/storage/tipos";

function clienteR2(): S3Client {
  const account = env.R2_ACCOUNT_ID;
  const endpoint =
    env.R2_ENDPOINT ||
    (account ? `https://${account}.r2.cloudflarestorage.com` : "");
  if (!endpoint || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new DocumentExtractError(
      "storage_failed",
      "R2 escolhido mas R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY estão vazios.",
    );
  }
  return new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export function r2Configurado(): boolean {
  return Boolean(
    (env.R2_ENDPOINT || env.R2_ACCOUNT_ID) &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY,
  );
}

export function r2DocumentStorage(deps?: { client?: S3Client }): DocumentStorage {
  const clientOf = () => deps?.client ?? clienteR2();
  return {
    provider: "r2",
    async put({ organizationId, key, body, contentType }) {
      if (!chavePertenceAOrg(key, organizationId)) {
        throw new DocumentExtractError("storage_failed", "Path fora do prefixo da organização.");
      }
      const client = clientOf();
      await client.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET_KNOWLEDGE,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },
    async get({ organizationId, key }) {
      if (!chavePertenceAOrg(key, organizationId)) {
        throw new DocumentExtractError("storage_failed", "Path fora do prefixo da organização.");
      }
      const client = clientOf();
      const out = await client.send(
        new GetObjectCommand({ Bucket: env.R2_BUCKET_KNOWLEDGE, Key: key }),
      );
      const bytes = await out.Body?.transformToByteArray();
      if (!bytes) {
        throw new DocumentExtractError("storage_failed", "Objeto R2 vazio.");
      }
      return Buffer.from(bytes);
    },
    async delete({ organizationId, key }) {
      if (!chavePertenceAOrg(key, organizationId)) return;
      const client = clientOf();
      await client.send(
        new DeleteObjectCommand({ Bucket: env.R2_BUCKET_KNOWLEDGE, Key: key }),
      );
    },
    async exists({ organizationId, key }) {
      if (!chavePertenceAOrg(key, organizationId)) return false;
      try {
        const client = clientOf();
        await client.send(
          new HeadObjectCommand({ Bucket: env.R2_BUCKET_KNOWLEDGE, Key: key }),
        );
        return true;
      } catch {
        return false;
      }
    },
  };
}
