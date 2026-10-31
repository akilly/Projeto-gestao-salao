/** Rotas de conta da titular (/api/auth/*): status, configuração, login, logout e redefinição de senha. Encaminha para lib/salon-auth.mjs com o D1. */
import { env } from 'cloudflare:workers';
import { handleAuth } from '../../../../lib/salon-auth.mjs';
export const dynamic='force-dynamic';
export async function GET(request: Request){return handleAuth(request,env.DB,env);}
export async function POST(request: Request){return handleAuth(request,env.DB,env);}
