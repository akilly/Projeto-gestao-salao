/** Diário local do conector (SQLite). Marca cada envio antes do efeito externo: timeout nunca causa reenvio. */
import { DatabaseSync } from 'node:sqlite';
export function openStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sends(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,status TEXT NOT NULL,provider_id TEXT);
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS config(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);`);
  // Colunas novas do modo "conector chama o site": resultado ainda não informado ao ateliê e motivo de falha.
  for (const column of ['reported INTEGER NOT NULL DEFAULT 1', 'error TEXT']) { try { db.exec('ALTER TABLE sends ADD COLUMN ' + column); } catch { /* já existe */ } }
  return {
    db,
    claim(id, fingerprint) { const old = db.prepare('SELECT * FROM sends WHERE id=?').get(id); if (old) { if (old.fingerprint !== fingerprint) throw Error('Tentativa já utilizada para outra mensagem.'); return old; } db.prepare("INSERT INTO sends (id,fingerprint,status,provider_id,reported) VALUES (?,?,'uncertain',NULL,0)").run(id, fingerprint); return null; },
    accepted(id, provider) { db.prepare("UPDATE sends SET status='accepted',provider_id=?,reported=0 WHERE id=?").run(provider, id); },
    failed(id, error) { db.prepare("UPDATE sends SET status='failed',error=?,reported=0 WHERE id=?").run(String(error).slice(0, 300), id); },
    /** Resultados ainda não confirmados pelo ateliê (inclui 'uncertain' para não reenviar). */
    unreported() { return db.prepare('SELECT id,status,provider_id,error FROM sends WHERE reported=0 LIMIT 50').all(); },
    reported(id) { db.prepare('UPDATE sends SET reported=1 WHERE id=?').run(id); },
    /** O ateliê ofereceu de novo um envio já tentado: informa o resultado outra vez, sem reenviar. */
    reportAgain(id) { db.prepare('UPDATE sends SET reported=0 WHERE id=?').run(id); },
    enqueue(event) { db.prepare('INSERT OR IGNORE INTO events VALUES (?,?)').run(event.id, JSON.stringify(event)); },
    /** Atualiza um evento pendente (ex.: anexo já enviado ao ateliê). */
    replace(event) { db.prepare('UPDATE events SET body=? WHERE id=?').run(JSON.stringify(event), event.id); },
    events() { return db.prepare('SELECT * FROM events ORDER BY rowid LIMIT 30').all(); },
    delivered(id) { db.prepare('DELETE FROM events WHERE id=?').run(id); },
    config(value) { if (value !== undefined) db.prepare('INSERT INTO config VALUES (1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(JSON.stringify(value)); return JSON.parse(db.prepare('SELECT payload FROM config WHERE id=1').get()?.payload || 'null'); }
  };
}
