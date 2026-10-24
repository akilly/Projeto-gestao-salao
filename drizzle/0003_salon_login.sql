CREATE TABLE salon_credentials (id INTEGER PRIMARY KEY CHECK(id=1), owner_id TEXT NOT NULL, email TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE salon_sessions (token_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE salon_login_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
