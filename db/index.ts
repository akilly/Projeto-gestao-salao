/**
 * Adaptador Drizzle para módulos que precisam de consultas tipadas. A API atual usa diretamente env.DB no handler para executar o batch atômico.
 * Referências: docs/DOCUMENTACAO_TECNICA.md e docs/REFERENCIA_FUNCOES.md.
 */
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
/** Retorna cliente Drizzle ligado ao DB desta execução; falha explicitamente quando o binding não foi provisionado. */
export function getDb() {
    if (!env.DB) {
        throw new Error("Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database.");
    }
    return drizzle(env.DB, { schema });
}
