/**
 * Integração de identidade do Sites: interpreta cabeçalhos fornecidos pela plataforma e monta retorno seguro do login. Não armazena senha nem implementa autenticação própria.
 * Referências: docs/DOCUMENTACAO_TECNICA.md e docs/REFERENCIA_FUNCOES.md.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export type ChatGPTUser = {
    userId: string;
    displayName: string;
    email: string;
    fullName: string | null;
};
const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";
/** Lê ID e email autenticados e decodifica o nome quando a plataforma indica UTF-8 percent-encoded; retorna null sem identidade completa. */
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
    const requestHeaders = await headers();
    const userId = requestHeaders.get(USER_ID_HEADER);
    const email = requestHeaders.get(USER_EMAIL_HEADER);
    if (!userId || !email)
        return null;
    const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
    const fullName = encodedFullName &&
        requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
        ? safeDecodeURIComponent(encodedFullName)
        : null;
    return {
        userId,
        displayName: fullName ?? email,
        email,
        fullName,
    };
}
/** Retorna a identidade autenticada ou redireciona ao login seguro com a rota de retorno. */
export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
    const user = await getChatGPTUser();
    if (user)
        return user;
    redirect(chatGPTSignInPath(returnTo));
}
/** Monta o caminho reservado de entrada da plataforma com destino relativo validado. */
export function chatGPTSignInPath(returnTo: string): string {
    const safeReturnTo = safeRelativeReturnPath(returnTo);
    return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}
/** Monta o caminho reservado de saída da plataforma com destino relativo validado. */
export function chatGPTSignOutPath(returnTo = "/"): string {
    const safeReturnTo = safeRelativeReturnPath(returnTo);
    return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}
/** Aceita somente retorno interno, recusa origem externa e evita ciclos nas rotas reservadas de autenticação. */
function safeRelativeReturnPath(value: string): string {
    if (!value.startsWith("/") || value.startsWith("//"))
        return "/";
    let url: URL;
    try {
        url = new URL(value, "https://app.local");
    }
    catch {
        return "/";
    }
    if (url.origin !== "https://app.local")
        return "/";
    if (isReservedAuthPath(url.pathname))
        return "/";
    return `${url.pathname}${url.search}${url.hash}`;
}
/** Reconhece caminhos que a própria plataforma usa para login, logout e callback. */
function isReservedAuthPath(pathname: string): boolean {
    return (pathname === SIGN_IN_PATH ||
        pathname === SIGN_OUT_PATH ||
        pathname === CALLBACK_PATH);
}
/** Decodifica o nome sem interromper a requisição se a sequência de caracteres for inválida. */
function safeDecodeURIComponent(value: string): string | null {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return null;
    }
}
