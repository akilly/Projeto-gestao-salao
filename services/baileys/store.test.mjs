import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from './store.mjs';
test('journal nunca repete tentativa incerta ou aceita; payload divergente é rejeitado',()=>{const store=openStore(':memory:');assert.equal(store.claim('r','hash'),null);assert.equal(store.claim('r','hash').status,'uncertain');assert.throws(()=>store.claim('r','other'));store.accepted('r','wa-id');assert.equal(store.claim('r','hash').provider_id,'wa-id');store.db.close();});
test('outbox mantém evento até confirmação e deduplica replay',()=>{const store=openStore(':memory:');store.enqueue({id:'e',body:'olá'});store.enqueue({id:'e',body:'olá'});assert.equal(store.events().length,1);store.delivered('e');assert.equal(store.events().length,0);store.config({channelId:'a'});assert.equal(store.config().channelId,'a');store.config(null);assert.equal(store.config(),null);store.db.close();});
