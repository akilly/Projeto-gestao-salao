/** /api/ai/{classify|summary|reply}: sugestões de IA (Workers AI) só para a titular autenticada. Lógica em lib/ai.mjs. */
import { env } from 'cloudflare:workers';
import { handleAI } from '../../../../lib/ai.mjs';
import { authorizeRequest } from '../../../../lib/salon-auth.mjs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const authorized = await authorizeRequest(request, env.DB);
  return authorized ? handleAI(authorized, env) : Response.json({ error: 'Entre na conta da Hanne.' }, { status: 401 });
}
export async function GET(request: Request) {
  // Estado da IA para a tela de Configurações: ativa ou não e uso de hoje.
  const authorized = await authorizeRequest(request, env.DB);
  return authorized ? handleAI(authorized, env) : Response.json({ error: 'Entre na conta da Hanne.' }, { status: 401 });
}
