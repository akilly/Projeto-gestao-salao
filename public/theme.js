/**
 * Aparência local do aplicativo. A preferência não é um registro de negócio:
 * fica neste navegador e pode ser alterada mesmo sem conexão com o banco.
 */
export const THEME_KEY = 'hanne-theme';

/** Recupera uma escolha válida. O primeiro acesso começa no tema claro. */
export function preferredTheme(storage) {
    try { return storage?.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
}

/** Aplica o tema e tenta lembrar a escolha sem impedir o uso se o armazenamento falhar. */
export function applyTheme(value, root, storage) {
    const theme = value === 'dark' ? 'dark' : 'light';
    if (root) {
        root.dataset.theme = theme;
        root.style.colorScheme = theme;
    }
    try { storage?.setItem(THEME_KEY, theme); } catch { /* Preferência opcional. */ }
    return theme;
}
