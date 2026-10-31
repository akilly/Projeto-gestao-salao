# Hanne · Gestão do ateliê

Sistema web em português para uma cabeleireira autônoma: agenda, clientes, atendimentos (WhatsApp), financeiro, estoque, serviços, orçamentos e tarefas. Pensado primeiro para o celular, com temas claro e escuro.

- **Hospedagem:** Cloudflare Workers (Vinext/Vite) + banco D1 + Workers KV (anexos do WhatsApp). Cabe no plano gratuito.
- **Testar no seu computador:** duplo clique em `INICIAR-HANNE.cmd` ([guia](docs/RODAR_NO_PC.md)).
- **Publicar na nuvem gratuita:** siga o [DEPLOY.md](DEPLOY.md).
- **Manual da usuária:** [docs/MANUAL_USUARIO.md](docs/MANUAL_USUARIO.md).

## O que o sistema faz

| Área | Resumo |
|---|---|
| Visão geral | Agenda de hoje, pendências, resumo financeiro do período e gráficos |
| Agenda | Dia, mês ou tudo; horários sobrepostos só com confirmação explícita; cadastro rápido de cliente na reserva |
| Atendimentos | WhatsApp pelo conector no computador do ateliê (QR Code) ou link wa.me com mensagem pronta; notas internas |
| Clientes | Cadastro, histórico de visitas, saldos e fichas técnicas |
| Financeiro | Cobranças, pagamentos (Pix, dinheiro, cartão com parcelas e repasses), despesas, sinais e gráficos |
| Estoque | Produtos em g/ml/unidade, compras, consumo por atendimento, perdas e custo médio |
| Serviços | Catálogo e histórico mensal dos atendimentos |
| Orçamentos e tarefas | Propostas com fotos e lista de afazeres |
| Configurações | Expediente, conta do espaço, tema, exportações (CSV, PDF, JSON) e restauração |

Toda exclusão pede confirmação **e a senha da conta**, e mostra antes tudo o que será apagado junto (vínculos).

## Como rodar no computador (desenvolvimento)

```bash
npm ci
npm run user:test:create   # cria teste@hanne.local / HanneTeste#2026 só no banco local
npm run dev                # http://localhost:5173
```

Abra `/?dados=exemplo` para usar a **demonstração** com dados fictícios (isolada da base real).

## Testes e verificação

```bash
npm test                              # regras de negócio, API, persistência (SQLite real), WhatsApp
npx tsc --noEmit                      # tipos
npm run lint                          # ESLint
(cd services/baileys && npm ci && npm test)   # conector do WhatsApp
```

## Estrutura

```
app/            Rotas do servidor (HTML da página, login, /api/state, /api/auth, /api/whatsapp)
lib/            Regras do servidor: estado e persistência, login, WhatsApp (Baileys e Meta)
public/         Interface (JavaScript puro em módulos) e estilos
db/, drizzle/   Esquema do banco e migrações (não alterar migrações já aplicadas)
services/baileys/  Conector do WhatsApp que roda no computador do ateliê (Node + Baileys)
scripts/        Deploy, testes, dev e infraestrutura do modelo de projeto
tests/          Testes automatizados (node:test)
docs/           Documentação técnica e manuais
```

Detalhes de cada arquivo: [docs/MAPA_ARQUIVOS.md](docs/MAPA_ARQUIVOS.md).

## Regras importantes

- **Conta única:** só a titular entra. Primeiro acesso e "Esqueci minha senha" por link no e-mail (Brevo) ou pelo código de configuração (`SETUP_TOKEN`).
- **Gravação segura:** o estado é salvo no D1 com revisão otimista e auditoria na mesma transação. Edição concorrente gera conflito explícito, sem perder o rascunho.
- **Histórico financeiro preservado:** valores confirmados não são sobrescritos; exclusões seguem um plano de cascata validado pelo servidor.
- **Demonstração isolada:** `/?dados=exemplo` usa outra base; a API recusa gravar dados fictícios na base real.
- **Limites:** 3 MB por gravação, 10 mil itens por coleção, até 3 fotos de 500 KB por orçamento.

## WhatsApp

Dois caminhos convivem:

1. **Link wa.me** (sempre disponível): abre o WhatsApp com a mensagem pronta e editável, com o contexto da cliente.
2. **Conector Baileys** (opcional, gratuito): roda no computador do ateliê e conversa com o site; as conversas aparecem dentro do sistema. Instalação: [docs/WHATSAPP_NO_COMPUTADOR.md](docs/WHATSAPP_NO_COMPUTADOR.md). Detalhes técnicos: [docs/INTEGRACAO_BAILEYS.md](docs/INTEGRACAO_BAILEYS.md).

O servidor também mantém o adaptador da **API oficial da Meta** (sem botão na tela atual): [docs/INTEGRACAO_WHATSAPP.md](docs/INTEGRACAO_WHATSAPP.md).

## Documentação

| Documento | Para quem | Conteúdo |
|---|---|---|
| [MANUAL_USUARIO.md](docs/MANUAL_USUARIO.md) e [Manual com prints (PDF)](docs/manual/Manual-Hanne.pdf) | Profissional | Rotina de uso, tela por tela |
| [RODAR_NO_PC.md](docs/RODAR_NO_PC.md) | Profissional | Rodar no computador e migrar para a nuvem depois |
| [DEPLOY.md](DEPLOY.md) | Quem publica | Publicação na Cloudflare, segredos e primeiro acesso |
| [WHATSAPP_NO_COMPUTADOR.md](docs/WHATSAPP_NO_COMPUTADOR.md) | Profissional | Instalar o conector do WhatsApp no Windows |
| [DOCUMENTACAO_TECNICA.md](docs/DOCUMENTACAO_TECNICA.md) | Desenvolvimento | Arquitetura, modelo de dados, API, cálculos e segurança |
| [REFERENCIA_FUNCOES.md](docs/REFERENCIA_FUNCOES.md) | Desenvolvimento | Catálogo das funções |
| [MAPA_ARQUIVOS.md](docs/MAPA_ARQUIVOS.md) | Desenvolvimento | O que cada arquivo faz |
| [EXCLUSAO_REGISTROS.md](docs/EXCLUSAO_REGISTROS.md) | Desenvolvimento | Regras de exclusão e cascata |
| [SEGURANCA.md](docs/SEGURANCA.md) | Desenvolvimento | Revisão de segurança, proteções e riscos conhecidos |
| [DESIGN.md](DESIGN.md), [SISTEMA_VISUAL.md](docs/SISTEMA_VISUAL.md), [UX-CONTRACT.md](UX-CONTRACT.md) | Design | Identidade visual, componentes e comportamento |

Ao mudar uma tela, um cálculo, um limite ou um contrato da API, atualize também o documento correspondente.

## Fora do escopo atual

IA de classificação/transcrição, notificações push, exportação XLSX nativa, backups automáticos e estornos financeiros por lançamento de reversão.
