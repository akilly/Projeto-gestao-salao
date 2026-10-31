-- Vários salões: cada conta (salon_users) tem os próprios registros, chaveados pelo owner_id.
-- A conta que já existia vira a titular (admin), com o mesmo owner_id: os dados atuais continuam com ela.
CREATE TABLE salon_users (owner_id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', disabled INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
INSERT INTO salon_users (owner_id, email, salt, password_hash, role, disabled, created_at) SELECT owner_id, lower(trim(email)), salt, password_hash, 'admin', 0, 0 FROM salon_credentials;
--> statement-breakpoint
DROP TABLE salon_credentials;
--> statement-breakpoint
-- Links: a qual conta pertencem (nova senha, troca de e-mail). Convites ainda não têm conta.
ALTER TABLE salon_tokens ADD COLUMN owner_id TEXT;
--> statement-breakpoint
-- Cota diária da IA passa a ser contada por salão.
DROP TABLE ai_usage;
--> statement-breakpoint
CREATE TABLE ai_usage (day TEXT NOT NULL, owner_id TEXT NOT NULL, task TEXT NOT NULL, calls INTEGER NOT NULL, PRIMARY KEY (day, owner_id, task));
