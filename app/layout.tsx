/**
 * Layout e metadados do App Router. A rota HTML explícita de app/route.ts é a entrada atual da aplicação.
 * Referências: docs/DOCUMENTACAO_TECNICA.md e docs/REFERENCIA_FUNCOES.md.
 */
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Hanne · Gestão do ateliê', description: 'Atendimentos, finanças e estoque em um só lugar, com registros reais e acesso privado.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="pt-BR"><head><link rel="stylesheet" href="/style.css"/><meta name="theme-color" content="#f3f0f8"/></head><body>{children}</body></html>; }
