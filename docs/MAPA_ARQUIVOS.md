# Mapa dos arquivos

Inventário dos arquivos versionados. Os módulos de negócio estão comentados no próprio código; o catálogo detalhado de funções está em REFERENCIA_FUNCOES.md. O produto atual usa os módulos em `public` sobre o runtime Vinext.

| Arquivo | Papel |
| --- | --- |
| `.openai/hosting.json` | Manifesto da hospedagem |
| `README.md` | Documentação |
| `app/api/auth/[...path]/route.ts` | Rota da conta titular e das sessões |
| `app/api/state/route.ts` | Rota, autenticação ou estrutura do servidor |
| `app/api/whatsapp/[...path]/route.ts` | Rota autenticada do canal WhatsApp |
| `app/layout.tsx` | Rota, autenticação ou estrutura do servidor |
| `app/login/route.ts` | HTML da entrada e do cadastro inicial |
| `app/route.ts` | Rota, autenticação ou estrutura do servidor |
| `build/connector-preview-plugin.mjs` | Infraestrutura oficial de compilação e Worker |
| `build/connector-preview-worker.mjs` | Infraestrutura oficial de compilação e Worker |
| `build/sites-vite-plugin.LICENSE` | Infraestrutura oficial de compilação e Worker |
| `build/sites-vite-plugin.ts` | Infraestrutura oficial de compilação e Worker |
| `build/sites-worker.ts` | Infraestrutura oficial de compilação e Worker |
| `cloudflare-env.d.ts` | Configuração do projeto |
| `db/schema.ts` | Esquema ou adaptador D1 |
| `drizzle.config.ts` | Configuração do projeto |
| `drizzle/0000_big_elektra.sql` | Histórico gerado de migração aplicado e preservado |
| `drizzle/meta/0000_snapshot.json` | Histórico gerado de migração aplicado e preservado |
| `drizzle/meta/_journal.json` | Histórico gerado de migração aplicado e preservado |
| `eslint.config.mjs` | Configuração do projeto |
| `lib/connector-context.ts` | Infraestrutura de conectores do starter, sem conexão de negócio ativa |
| `lib/connector-contract.mts` | Infraestrutura de conectores do starter, sem conexão de negócio ativa |
| `lib/connector-errors.mts` | Infraestrutura de conectores do starter, sem conexão de negócio ativa |
| `lib/connector-preview.d.ts` | Infraestrutura de conectores do starter, sem conexão de negócio ativa |
| `lib/state-handler.mjs` | API de estado e persistência autenticada |
| `lib/salon-auth.mjs` | Cadastro, credenciais, sessões e autorização |
| `next.config.ts` | Configuração do projeto |
| `package.json` | Dependências e configuração do gerenciador |
| `pnpm-lock.yaml` | Dependências e configuração do gerenciador |
| `pnpm-workspace.yaml` | Dependências e configuração do gerenciador |
| `public/app.js` | Interface, utilitário ou recurso estático da aplicação |
| `public/form-validation.js` | Validação acessível compartilhada pelos formulários |
| `public/core.js` | Interface, utilitário ou recurso estático da aplicação |
| `public/domain.js` | Interface, utilitário ou recurso estático da aplicação |
| `public/examples.js` | Interface, utilitário ou recurso estático da aplicação |
| `public/favicon.svg` | Interface, utilitário ou recurso estático da aplicação |
| `public/style.css` | Interface, utilitário ou recurso estático da aplicação |
| `scripts/build-verified.sh` | Instalação, execução e suporte de ambiente do starter |
| `scripts/create-local-test-user.mjs` | Criação explícita de credencial somente no D1 local |
| `scripts/connector-preview/connector-preview-session.mjs` | Instalação, execução e suporte de ambiente do starter |
| `scripts/connector-preview/host-binding.mjs` | Instalação, execução e suporte de ambiente do starter |
| `scripts/connector-preview/protocol.mjs` | Instalação, execução e suporte de ambiente do starter |
| `scripts/execution-profile.mjs` | Instalação, execução e suporte de ambiente do starter |
| `scripts/install-ci.mjs` | Instalação, execução e suporte de ambiente do starter |
| `scripts/install-ci.sh` | Instalação, execução e suporte de ambiente do starter |
| `scripts/install-pnpm.sh` | Instalação, execução e suporte de ambiente do starter |
| `scripts/npm-install.mjs` | Instalação, execução e suporte de ambiente do starter |
| `scripts/pnpm-install.mjs` | Instalação, execução e suporte de ambiente do starter |
| `scripts/run-framework.mjs` | Instalação, execução e suporte de ambiente do starter |
| `scripts/sites-env.mjs` | Instalação, execução e suporte de ambiente do starter |
| `scripts/sites-env.sh` | Instalação, execução e suporte de ambiente do starter |
| `tests/core.test.mjs` | Verificação automatizada do comportamento |
| `tests/domain.test.mjs` | Verificação automatizada do comportamento |
| `tests/examples.test.mjs` | Verificação automatizada do comportamento |
| `tests/pending-ui.test.mjs` | Verificação automatizada do comportamento |
| `tests/persistence.test.mjs` | Verificação automatizada do comportamento |
| `tsconfig.json` | Configuração do projeto |
| `vendor/shadcn-tailwind-4.13.0.LICENSE.md` | Código de terceiros preservado com licença |
| `vendor/shadcn-tailwind-4.13.0.css` | Código de terceiros preservado com licença |
| `vite.config.ts` | Configuração do projeto |

| `public/theme.js` | Preferência local de aparência e aplicação do tema |
| `public/theme.css` | Tokens de cores e componentes para claro e escuro suave |
| `tests/theme.test.mjs` | Persistência da aparência e tolerância a armazenamento bloqueado |


## Arquivos da revisão mensal e visual

| Arquivo | Responsabilidade |
| --- | --- |
| public/routine.js | Consultas mensais, conjuntos, sugestões de consumo e conta atual do espaço |
| public/atelier.css | Direção visual final de todas as páginas e cartões no celular |
| tests/routine.test.mjs | Preservação do histórico, valores por conjunto e automações |
| docs/SISTEMA_VISUAL.md | Paleta, componentes, organização e critérios de acessibilidade |

Os testes de pendências também verificam consulta mensal e ajuda de todas as páginas; os de persistência verificam a conta automática em aberto e a concorrência.


## Consulta diária e destinos relacionados

- `public/navigation.js`: filtros de dia/mês/histórico, URLs permitidas, datas civis e paginação.
- `public/destinations-ui.js`: detalhes de leitura e relações entre atendimento, cobrança, pagamento, repasse e despesa.
- `tests/navigation.test.mjs`: seleção sem mutação, conjuntos exatos, preservação de preço, parâmetros e limites de páginas.
- `DESIGN.md` e `UX-CONTRACT.md`: identidade e comportamento compartilhados.
- `premium-ui.json`: configuração de auditoria e comandos de verificação.
- `docs/VERIFICACAO_PROCEDIMENTOS.md`: evidências e limites da revisão.


- `public/booking.js`: validação de contato e horário; preparação conjunta de cadastro e reserva.
- `tests/booking.test.mjs`: atomicidade local, conflitos, telefone com DDI e bloqueios.
- `docs/INTEGRACAO_WHATSAPP.md`: recomendação de provedor e dependências ainda pendentes; não documenta uma conexão ativa.
