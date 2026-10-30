/** Tipos dos bindings do Worker. Declara contratos de compilação; não cria bancos nem credenciais. */
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    WHATSAPP_ENCRYPTION_KEY?: string;
    /** Anexos do WhatsApp (Baileys): recebidos e a enviar, com expiração. */
    MEDIA?: KVNamespace;
  }
}
