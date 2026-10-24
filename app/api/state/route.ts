/**
 * Adaptador Vinext da API de estado. Encaminha GET e POST ao handler compartilhado com o binding D1 DB.
 * Referências: docs/DOCUMENTACAO_TECNICA.md e docs/REFERENCIA_FUNCOES.md.
 */
import { env } from 'cloudflare:workers';
import { handleStateRequest } from '../../../lib/state-handler.mjs';
import { authorizeRequest } from '../../../lib/salon-auth.mjs';
export const dynamic = 'force-dynamic';
/**
 * GET — Encaminha a requisição ao handler de estado e ao banco D1.
 */
export async function GET(request: Request) { const authorized=await authorizeRequest(request,env.DB); return authorized ? handleStateRequest(authorized, env.DB) : Response.json({error:'Entre na conta da Hanne.'},{status:401}); }
/**
 * POST — Encaminha a requisição ao handler de estado e ao banco D1.
 */
export async function POST(request: Request) { const authorized=await authorizeRequest(request,env.DB); return authorized ? handleStateRequest(authorized, env.DB) : Response.json({error:'Entre na conta da Hanne.'},{status:401}); }

export async function DELETE(request: Request) { const authorized=await authorizeRequest(request,env.DB); return authorized ? handleStateRequest(authorized,env.DB) : Response.json({error:'Entre na conta da Hanne.'},{status:401}); }
