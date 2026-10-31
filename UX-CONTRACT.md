# UX Contract

## Product context

Hanne usa o aplicativo no celular para agenda, conclusão de visitas, recebimentos e estoque. Interface pt-BR, valores BRL e calendário gregoriano com datas civis em America/Sao_Paulo. Objetivo de acessibilidade: WCAG 2.2 AA; inspeção realizada não equivale a certificação integral.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Permission model | `docs/DOCUMENTACAO_TECNICA.md` — API e isolamento; `lib/salon-auth.mjs` | Contrato mantido e implementação de autenticação | 2026-10-25 |
| Data lifecycle | `docs/DOCUMENTACAO_TECNICA.md` — estado e persistência; `public/domain.js` | Contrato e invariantes | 2026-10-20 |
| Deletion / retention | `public/domain.js` — validateState; `docs/MANUAL_USUARIO.md` — correções | Invariantes e manual | 2026-10-20 |
| Billing / payment | Histórico de requisitos; `docs/DOCUMENTACAO_TECNICA.md`; `tests/domain.test.mjs` | Requisitos, contrato e testes | 2026-10-20 |
| Legal / regulatory copy | Nenhuma alteração legal nesta entrega | Escopo | 2026-10-20 |
| Market / content conventions | Histórico de requisitos; `docs/SISTEMA_VISUAL.md` | Brief e contexto mantido | 2026-10-20 |

## Visual contract

`DESIGN.md` espelha o runtime canônico `public/atelier.css`, aplicado após `style.css` e `theme.css`. Temas claro e escuro suave compartilham estrutura. Verificar deriva por revisão de CSS e navegação nos dois temas. Não gerar uma segunda fonte de tokens.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | selectField em public/app.js | HTML select nativo | Popup do navegador/OS aceito | Teclado e seleção no navegador |
| Date | field e filtros em public/app.js | input date/time/month nativo + public/core.js | Locale e popup do navegador/OS aceitos | Data civil, edição e Escape |
| Form | openForm + validateVisibleControls + checkFinishStep | public/app.js + public/form-validation.js | Etapas de fechamento, login e formulários simples | Validação, salvamento e recuperação |
| Scrollbar | Baseline global | public/atelier.css | Gutter e largura por superfície | Computed style e viewport estreito |
| Toast | toast + syncBanner | public/app.js | Sucesso breve; erro persistente no banner | Recuperação e live region |
| CRUD | navigateTo, modal, persist e domain | public/app.js + public/domain.js | Consultar antes de operar; com exclusão por plano confirmado | Testes e fluxos no navegador |

Seleção de tabela em massa não existe neste escopo.

## Canal WhatsApp

Contrato de domínio: `docs/INTEGRACAO_WHATSAPP.md`, `docs/INTEGRACAO_BAILEYS.md` e `lib/whatsapp-domain.mjs`. `public/whatsapp.js` é proprietário do transporte e da caixa, reutilizando campos, validação, toast e diálogos de `app.js`. Mensagens e status não usam snapshots financeiros.

Conexão (Baileys): a titular cola a chave gerada pelo instalador do conector; o QR Code real aparece na tela assim que o conector sincroniza. A tela mostra se o conector está online e orienta quando não está. Nenhum segredo volta na API. Desconectar pede confirmação, encerra a sessão no computador e preserva o histórico.

Resposta tem tentativa única. Duplo clique/repetição reutiliza o identificador. No Baileys a mensagem fica "Na fila do conector" até o computador confirmar; resultado incerto exige conferir no celular e nunca é reenviado sozinho. O campo é preservado em falhas definitivas. Na API oficial da Meta, o prazo de 24 h é validado no servidor e de novo após o upload.

Rascunhos ficam em memória por conversa, inclusive ao trocar de tela. Recarregar/fechar avisa quando há rascunho. Polling ignora respostas antigas e não substitui o compositor; a caixa informa falhas de consulta e permite Atualizar. Caixa e histórico paginam sem excluir registros. Resolver é uma organização interna, não envia mensagem, não finaliza atendimento e não marca leitura no telefone. Nova mensagem de cliente reabre a pendência; replay não reabre. O contador do menu e o indicador do painel somam WhatsApp e notas internas. A demonstração não acessa o canal real.

Upload é um arquivo por mensagem, com picker nativo acessível, prévia de imagem, nome/tamanho, remoção e validação cliente/servidor. Não há gravação de microfone nem transcodificação automática. Datas/horas de mensagens são instantes exibidos em America/Sao_Paulo. Não colocar contatos ou textos em URLs de navegação.

## Dataset navigation

Procedimentos abrem em Dia/Hoje. Dia, mês e todo o histórico são consultas do mesmo snapshot. Filtros por serviço, conjunto exato e cliente combinam-se ao período. Listas de procedimentos, financeiro e estoque usam 10 linhas por página, contagem completa e limites desabilitados. Filtro reduzido limita a página válida. Catálogo e demais listas conservam os componentes existentes.

URLs carregam somente página, IDs e filtros permitidos por `navigation.js`; não carregam nome, telefone, texto livre ou instrução de mutação. Histórico guarda estado visual e rolagem, sem copiar a base financeira. Voltar restaura a consulta anterior. Detalhes têm fechamento e destinos relacionados. Falta de entidade tem mensagem própria. Carregamento, consulta vazia e falha da base mantêm explicação e recuperação.

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| Consultar visita | Ver atendimento | Sem mutação | Ficha de consulta | Valores e vínculos | Registro ausente + fechar | Primeiro controle do diálogo | Requisitos desta entrega |
| Consultar valor | Link de cobrança/pagamento | Sem mutação | Detalhe correspondente | Situação e origem | Retornar à lista | Diálogo acessível | Contrato financeiro citado acima |
| Criar/editar | Formulário explícito | Snapshot em fila | Lista proprietária | Toast só após confirmação da API | Banner + tentar novamente/exportar | Retorno ao acionador quando existente | Documentação técnica, persistência |
| Cancelar/Voltar | Fechar ou navegar | Confirmação só se houver edição | Contexto anterior | Sem toast para consulta | Continuar editando preserva nó/valores | Acionador/campo anterior | Primitivos compartilhados |
| Exclusão financeira | Não oferecida | Não aplicável | Não aplicável | Não aplicável | Orientação técnica | Não aplicável | domain.validateState |

## Navigation and responsive behavior

Títulos em português por página. Breadcrumb hierárquico, grupos de período com `aria-pressed` e âncoras para destinos. Menu lateral vira navegação inferior/Mais. Células ganham rótulos no celular sem remover ações. Cabeçalho recebe foco após navegação; listas podem receber foco no título para paginação. Novos atalhos são semânticos e utilizáveis por teclado.

## Overlays and feedback

Proprietário: `modal()` com `<dialog>.showModal()`, top layer, fundo inerte e corpo rolável. Escape e backdrop passam por `closeModal()`. Edições não salvas usam diálogo do aplicativo com Continuar editando como foco inicial; o formulário original é preservado. Operações confirmadas não abrem descarte. Erros de sincronização persistem no banner; navegação de consulta continua disponível.

## Async and resilience

Arquitetura existente: fila serial de snapshots com revisão/CAS, confirmação pelo servidor e bloqueio de novas operações quando salvando/erro/conflito. Não reenviar em paralelo. API rejeita revisão vencida; rascunho permanece em memória e pode ser exportado ou refeito após recarregar. Falha da rede não é anunciada como sucesso. Consultas locais não fazem requisições adicionais nem alteram registros. Reautenticação e isolamento continuam sob o contrato da API; não mudou público ou propriedade dos dados.

## Validation

Restrições HTML inspecionadas sem balões nativos, erro associado e primeiro foco inválido. Validação de domínio e de estado continua obrigatória no cliente e servidor. Valores financeiros, datas e estoque não dependem somente da validação visual. `novalidate` não remove as restrições do domínio. Textareas usam `resize-none` com altura suficiente/autogrow. Não há senha própria neste aplicativo.

## Migration status

Esta entrega migra as consultas e seus destinos em Serviços, Agenda, Financeiro e Estoque. Conversas, configurações e catálogo continuam usando os proprietários existentes. Não criar nova família de formulários ou tabelas. A auditoria genérica não reconhece eventos delegados `data-action`: classificar esses achados com inspeção do handler, sem adicionar `onclick` artificial ou remover ações para satisfazer uma expressão regular.

## Verification

Comandos: `node --test tests/*.test.mjs`, `npm run lint`, `node_modules/.bin/tsc --noEmit --incremental false`, build oficial Sites. Auditoria estrita e lint DESIGN registrados em `docs/VERIFICACAO_PROCEDIMENTOS.md`. Testes de integração cobrem integridade financeira e persistência. Navegador cobre dia/mês, filtros, paginação, detalhes, Voltar, teclado, estreito, temas, sucesso e recuperação de erro com API temporária de dados fictícios; o harness não faz parte da publicação. Não existe operação de apagar atendimento nesta entrega. Revisão prática com Hanne e teclado virtual em aparelho físico ainda dependem de uso real.


## Variante de cadastro dentro da agenda

O novo agendamento permite cliente existente ou cadastro novo no mesmo formulário. Campos e rolagem usam os proprietários atuais. Nome/telefone/situação ficam em uma seção recolhível; mudar o modo não reinicializa a reserva. A confirmação prepara cliente e agendamento juntos e falha sem mutação parcial. Cancelar antes de confirmar não cria cliente. Contatos coincidentes são apresentados para escolha manual, incluindo equivalência brasileira com/sem +55. A API e o isolamento continuam os mesmos. Essa variante atende ao requisito de cadastrar sem sair da agenda; não é um segundo CRUD independente.

## Alteração autorizada em 24/10/2026 — Baileys e exclusão

Fonte: pedido do titular nesta data; política e limites em docs/EXCLUSAO_REGISTROS.md e docs/INTEGRACAO_BAILEYS.md. Substitui a ausência anterior de CRUD delete: exclusão permanente de cadastros sem vínculos, confirmação com objeto/consequência, foco em ação segura, validação no servidor e sucesso somente após persistência. Financeiro/estoque confirmado permanece protegido. Erro conserva o rascunho na fila e apresenta recuperação. Não há Undo desonesto.

O conector externo Baileys é exclusivo por conta/número, usa HTTPS/Bearer e eventos HMAC. Configuração usa openForm e campos existentes, chave mascarada e sem armazenamento no navegador. QR real e temporário vem do conector autenticado. Não há QR ilustrativo. UI diferencia aguardando conector, pareamento, sessão conectada e erro. A resposta depende da sessão, sem aplicar a janela de 24h das APIs oficiais ao Baileys. Ativação real e hospedagem do conector estão pendentes.


## Conta e exclusões — decisão da versão 13

A solicitação atual autoriza exclusão de todas as informações operacionais com confirmação. Usar a lista comum, busca textual, prévia de dependências e checkbox obrigatório. Nunca remover dados ao navegar. A API DELETE tem plano e revisão próprios; não afrouxar POST. Mostrar nomes, datas e valores, sem exigir interpretação de IDs. O fluxo de acesso tem formulário sem cadastro público, mensagens inline, mostrar/ocultar senha e recuperação pela titular. Reutiliza tokens e tema existentes. Primeiro acesso e recuperação usam a identidade Sites, preservando os dados da titular original. A configuração técnica do WhatsApp ocorre uma vez; os próximos pareamentos reutilizam o acesso salvo.
