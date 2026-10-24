/** Journal durável: marca tentativa antes do efeito externo; timeout nunca causa reenvio. */
import { DatabaseSync } from 'node:sqlite';
export function openStore(path) {
  const db=new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sends(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,status TEXT NOT NULL,provider_id TEXT);
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS config(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);`);
  return {
    db,
    claim(id,fingerprint){const old=db.prepare('SELECT * FROM sends WHERE id=?').get(id);if(old){if(old.fingerprint!==fingerprint)throw Error('Tentativa já utilizada para outra mensagem.');return old;}db.prepare("INSERT INTO sends VALUES (?,?,'uncertain',NULL)").run(id,fingerprint);return null;},
    accepted(id,provider){db.prepare("UPDATE sends SET status='accepted',provider_id=? WHERE id=?").run(provider,id);},
    enqueue(event){db.prepare('INSERT OR IGNORE INTO events VALUES (?,?)').run(event.id,JSON.stringify(event));},
    events(){return db.prepare('SELECT * FROM events ORDER BY rowid LIMIT 30').all();},
    delivered(id){db.prepare('DELETE FROM events WHERE id=?').run(id);},
    config(value){if(value!==undefined)db.prepare('INSERT INTO config VALUES (1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(JSON.stringify(value));return JSON.parse(db.prepare('SELECT payload FROM config WHERE id=1').get()?.payload||'null');}
  };
}
