/** Tipos dos bindings do Worker. Declara contratos de compilação; não cria bancos nem credenciais. */
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    WHATSAPP_ENCRYPTION_KEY?: string;
    /** Anexos do WhatsApp (Baileys): recebidos e a enviar, com expiração. */
    MEDIA?: KVNamespace;
    /** Código do primeiro acesso/recuperação sem e-mail (mínimo 16 caracteres). */
    SETUP_TOKEN?: string;
    /** E-mails pelo Brevo: chave de API, remetente confirmado e nome exibido. */
    BREVO_API_KEY?: string;
    MAIL_FROM?: string;
    MAIL_FROM_NAME?: string;
    /** Único e-mail que pode receber o link de primeiro acesso. */
    OWNER_EMAIL?: string;
    /** Endereço público usado nos links dos e-mails (ex.: https://hanne-atelier.SEU-USUARIO.workers.dev). */
    APP_ORIGIN?: string;
  }
}
