/** A aparência é local: escolhas persistem sem gravação no banco e sem quebrar o uso se o navegador bloquear armazenamento. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { preferredTheme, applyTheme, THEME_KEY } from '../public/theme.js';

test('primeiro acesso e preferência inválida usam claro; escuro salvo é recuperado', () => {
    assert.equal(preferredTheme({getItem:()=>null}), 'light');
    assert.equal(preferredTheme({getItem:()=> 'invalido'}), 'light');
    assert.equal(preferredTheme({getItem:()=> 'dark'}), 'dark');
});
test('troca atualiza o documento e salva somente a preferência de aparência', () => {
    const writes=[], root={dataset:{},style:{}};
    applyTheme('dark',root,{setItem:(...args)=>writes.push(args)});
    assert.equal(root.dataset.theme, 'dark');
    assert.equal(root.style.colorScheme, 'dark');
    assert.deepEqual(writes,[[THEME_KEY,'dark']]);
    applyTheme('light',root,null);
    assert.equal(root.dataset.theme,'light');
});
test('armazenamento bloqueado não impede abrir nem trocar o tema', () => {
    const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
    assert.equal(preferredTheme(blocked),'light');
    const root={dataset:{},style:{}};
    assert.equal(applyTheme('dark',root,blocked),'dark');
    assert.equal(root.dataset.theme,'dark');
});
