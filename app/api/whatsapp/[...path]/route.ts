/** APIs de atendimento exigem identidade; só o webhook assinado aceita acesso do provedor. */
import { env } from 'cloudflare:workers';
import { handleWhatsApp } from '../../../../lib/whatsapp-handler.mjs';
import { authorizeRequest } from '../../../../lib/salon-auth.mjs';
async function dispatch(request: Request) {
 if (/\/api\/whatsapp\/(webhook|meta-webhook|baileys-webhook)\/[^/]+$/.test(new URL(request.url).pathname)) return handleWhatsApp(request,env);
 const authorized=await authorizeRequest(request,env.DB);return authorized?handleWhatsApp(authorized,env):Response.json({error:'Entre na conta da Hanne.'},{status:401});
}
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return dispatch(request); }
export async function POST(request: Request) { return dispatch(request); }
export async function DELETE(request: Request) { return dispatch(request); }
