export type KnowledgeStorageProvider = "supabase" | "r2";

export interface DocumentStorage {
  readonly provider: KnowledgeStorageProvider;
  put(args: {
    organizationId: string;
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void>;
  get(args: { organizationId: string; key: string }): Promise<Buffer>;
  delete(args: { organizationId: string; key: string }): Promise<void>;
  exists(args: { organizationId: string; key: string }): Promise<boolean>;
}
