/** Configuração de geração das migrações a partir de db/schema.ts. Não aplicar alterações destrutivas ao banco de produção por este arquivo. */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "sqlite",
});
