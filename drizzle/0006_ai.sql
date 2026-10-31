-- Inteligência artificial: classificação guardada na conversa do WhatsApp e contador diário de uso (cota gratuita).
ALTER TABLE wa_threads ADD COLUMN ai_category TEXT;
--> statement-breakpoint
ALTER TABLE wa_threads ADD COLUMN ai_priority TEXT;
--> statement-breakpoint
ALTER TABLE wa_threads ADD COLUMN ai_reason TEXT;
--> statement-breakpoint
ALTER TABLE wa_threads ADD COLUMN ai_at TEXT;
--> statement-breakpoint
CREATE TABLE ai_usage (day TEXT NOT NULL, task TEXT NOT NULL, calls INTEGER NOT NULL, PRIMARY KEY (day, task));
