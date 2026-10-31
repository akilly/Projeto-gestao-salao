-- Links de uso único enviados por e-mail (primeiro acesso e "esqueci a senha"). Guarda só o hash do token.
CREATE TABLE salon_tokens (token_hash TEXT PRIMARY KEY, kind TEXT NOT NULL, email TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX salon_tokens_kind ON salon_tokens (kind, created_at);
