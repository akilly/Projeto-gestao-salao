# Documentação técnica do sistema Hanne

Referência de manutenção da aplicação de atendimentos, finanças e estoque da Hanne. Esta documentação descreve a implementação existente em 20 de outubro de 2026, seus contratos, cálculos e limites. Destina-se a quem vai corrigir ou evoluir o projeto. As instruções de operação estão em MANUAL_USUARIO.md; a relação das funções está em REFERENCIA_FUNCOES.md.

## Arquitetura e execução

O navegador recebe HTML pela rota app/route.ts, depois carrega public/app.js como módulo ES e as folhas public/style.css, public/theme.css e public/atelier.css, nesta ordem. A aplicação usa JavaScript e templates HTML com delegação de eventos. Vinext, React, Vite e Cloudflare Workers fornecem o runtime; as telas de negócio atuais usam os módulos em public.

A autenticação de uso é fornecida pela conta única da Hanne em lib/salon-auth.mjs. A plataforma Sites fornece identidade apenas para configurar/recuperar a conta pela titular. A audiência do endereço é configurada separadamente no Sites e estava pública na conferência final desta revisão. Isso não compartilha automaticamente o snapshot de uma conta: a rota de negócio exige identidade, e a API usa a chave do usuário autenticado. A rota de entrada valida a sessão opaca do salão e redireciona para /login quando necessário. O primeiro acesso ainda permite à titular autenticada pela plataforma configurar sua conta. Os caminhos reservados de login, logout e callback pertencem à plataforma. A API verifica o identificador autenticado injetado no cabeçalho; o navegador não escolhe qual titular acessar.

A rota /api/state encaminha GET e POST ao handler em lib/state-handler.mjs com env.DB. O D1 guarda um agregado JSON completo por base de usuário, acompanhado por revisão. Não há backend Supabase, processamento agendado, conexão bancária automática. O canal WhatsApp foi implementado separadamente e aguarda ativação da conta Meta, conforme INTEGRACAO_WHATSAPP.md.

Fluxo de leitura: autenticação → GET da base selecionada → carregamento no navegador → renderização. Fluxo de alteração: ação do usuário → alteração em memória ou cópia transacional → validação do domínio → fila de POST → validação no servidor → gravação condicionada à revisão → atualização da revisão confirmada e da auditoria.

## Mapa do código

| Arquivo ou diretório | Responsabilidade |
| --- | --- |
| public/app.js | Navegação, telas, diálogos, eventos, importação, exportação e fila de sincronização |
| public/routine.js | Filtros mensais, agregação por conjunto, referência de consumo e despesa mensal idempotente |
| public/core.js | Datas, horários, conflito de agenda, leitura e proteção de CSV, fixtures históricas |
| public/domain.js | Estado inicial, dinheiro, estoque, sinais, parcelas, métricas, fechamento e validação |
| public/examples.js | Demonstração coerente construída pelas regras de negócio |
| public/theme.js | Preferência local de tema, aplicação no documento e tolerância a falha no armazenamento |
| public/style.css, public/theme.css e public/atelier.css | Base visual, temas e direção visual final com cartões no celular |
| app/route.ts | HTML inicial com autenticação e referência aos módulos públicos |
| app/api/state/route.ts | Adaptador HTTP para o handler compartilhado |
| app/login/route.ts e public/login.js | Tela de entrada, cadastro inicial e recuperação da conta titular |
| app/layout.tsx | Estrutura de compatibilidade do App Router |
| lib/salon-auth.mjs | Credenciais, sessão, identidade de bootstrap e autorização das APIs |
| lib/state-handler.mjs | Isolamento, validação, revisão otimista, snapshot e evento D1 |
| db/schema.ts | Esquema Drizzle usado pela geração de migrações |
| drizzle | Migração SQL aplicada e seus metadados; histórico preservado |
| tests | Testes de domínio, utilitários, demonstração, API e renderização mínima |
| vite.config.ts e build | Configuração Vite e infraestrutura oficial do Worker Sites |
| scripts | Instalação, seleção do ambiente, execução e infraestrutura do starter |
| lib/connector* | Contratos e suporte do preview oficial de conectores |
| vendor | Dependências e código de terceiros preservados com licenças |
| package.json e pnpm-lock.yaml | Comandos, dependências e versões resolvidas |
| .openai/hosting.json | Identidade do Site e declaração dos bindings de hospedagem |

Os comentários explicam as funções da aplicação, os pontos de entrada, as configurações e os testes. A infraestrutura herdada e o código de terceiros mantêm seus comentários originais; o mapa acima explica sua relação com o produto. Arquivos gerados, lockfiles, SVGs e migrações aplicadas não recebem comentários artificiais. Não editar uma migração já aplicada para acrescentar explicações: criar nova migração quando o esquema realmente mudar.

## Estado e relacionamentos

O formato atual utiliza schema igual a 2. settings reúne nome, expediente, folgas, prazo de resposta de referência, data de início e participação fixa do espaço. focus controla a preferência de foco. audit contém os eventos recentes devolvidos pelo servidor.

| Coleção | Dados e vínculos principais |
| --- | --- |
| clients | Nome, telefone, tipo de cadastro, observações e alertas; ID referenciado pelas demais entidades |
| services | Nome, duração, intervalo e orientações técnicas; sem preço individual de referência obrigatório |
| appointments | Cliente, serviço, data, horário, duração, intervalo e situação; pode representar bloqueio |
| conversations | Cliente, categoria, situação, mensagens e rascunho internos; sem ingestão automática |
| quotes | Cliente, serviço, situação, valor avaliado, perguntas e fotos |
| records | Atendimento concluído com vários serviceIds, preço total, ficha técnica e vínculos com cobrança e agenda |
| bills | Valor cobrado, vencimento, cliente e recordId opcional |
| payments | Valor aceito, método, data, cliente, billId opcional e situação de sinal |
| installments | paymentId, número, bruto, taxa, vencimento e confirmação de repasse líquido |
| products | Nome, marca, unidade, tamanho da embalagem e mínimo; saldo vem dos movimentos |
| movements | Produto, quantidade assinada, tipo, data e custo unitário registrado naquele momento |
| expenses | Categoria, valor, data, vencimento e paidDate opcional; compra pode ser vinculada por expenseId |
| tasks | Título, área, prioridade, vencimento, conclusão e cliente opcional |

IDs são strings únicas dentro de cada coleção. Referências relevantes são verificadas por validateState. O servidor não implementa um esquema exaustivo de todas as propriedades livres de conversas, fotos e textos: a validação é concentrada em integridade operacional e financeira. Não tratar a validação atual como sanitização universal de objetos arbitrários.

## Contrato da API

GET /api/state lê a operação real. GET /api/state?dataset=example lê a demonstração. Uma seleção diferente e não vazia é recusada. A resposta inclui state, revision, updatedAt e dataset. Ausência de snapshot resulta no estado inicial, com revisão zero. A demonstração inicial é gerada em memória e passa a ter snapshot persistido na primeira alteração gravada.

POST usa a mesma seleção e Content-Type application/json. O corpo contém state completo, revision inteira não negativa e action textual opcional. A origem deve corresponder à URL da requisição. A resposta de sucesso contém revision, updatedAt e, quando houve alteração, audit. Uma alteração somente no campo audit não gera nova revisão.

| Código | Significado |
| --- | --- |
| 200 | Leitura ou gravação aceita; também usado quando não houve alteração material |
| 400 | JSON, revisão ou seleção de base inválidos |
| 401 | Identidade autenticada ausente |
| 403 | Origem da escrita diferente da origem do Site |
| 405 | Método não suportado pelo handler |
| 413 | Corpo acima de 3 milhões de caracteres após a leitura |
| 415 | Tipo de conteúdo não aceito |
| 422 | Estado incompatível com as regras de domínio ou identificação de base incorreta |
| 409 | Revisão desatualizada ou outra escrita venceu a disputa |
| 503 | Binding ausente ou falha de acesso ao banco |

Respostas usam JSON, Cache-Control private, no-store e X-Content-Type-Options nosniff. Consultas usam parâmetros vinculados. O limite do corpo é medido por raw.length, em caracteres JavaScript, e não por uma medição exata de bytes de rede. Cada coleção validada admite até 10 mil itens e IDs de até 100 caracteres.

## Persistência e concorrência

atelier_accounts possui user_id como chave primária, revision, payload e updated_at. atelier_events registra id, user_id, revision, action, changes e created_at. changes contém nomes das partes alteradas; não armazena uma cópia anterior completa. O payload mantém até 200 eventos recentes; a tabela de eventos recebe os eventos aceitos sem mecanismo de restauração disponível na interface.

A chave da operação real é o identificador autenticado. A chave da demonstração acrescenta o sufixo ::examples-v1. O marcador datasetKind example é obrigatório na base fictícia e recusado na base real. A preferência hanne-theme no localStorage escolhe claro ou escuro e não integra o snapshot. A preferência hanne-data-view no localStorage só escolhe a visualização; clientes, estoque e dinheiro ficam no banco, não no armazenamento local.

Na atualização, o handler lê a revisão anterior e valida o novo estado contra o anterior. O UPDATE inclui WHERE revision = revisão lida; a primeira gravação usa INSERT OR IGNORE. Um batch D1 executa a alteração do snapshot e a inserção do evento condicionada a changes() = 1. Se outra gravação vencer, a API responde 409. Não há mesclagem automática entre dois dispositivos.

No navegador, queueSave e flushSave serializam os envios. confirmedState representa a última versão confirmada, state contém o trabalho atual, revision acompanha o servidor e savePending sinaliza mudanças aguardando envio. Em conflito ou falha, o rascunho permanece na memória da aba para exportar ou conferir. Fechar a aba pode perdê-lo. Não há fila offline persistente nem garantia de atualização por polling em segundo plano.

## Dinheiro e indicadores

cents e amount convertem entre reais e centavos. splitCents distribui o resto entre as primeiras parcelas: R$ 100,00 em três partes resulta em 33,34, 33,33 e 33,33. plusMonths limita o vencimento ao último dia do mês quando o dia original não existe no destino. O código usa Number com arredondamento; não utiliza uma biblioteca decimal.

| Indicador | Regra |
| --- | --- |
| Valor dos atendimentos | Soma do preço total dos records pela data do atendimento |
| Recebido no período | Pagamentos diretos novos na data do pagamento mais repasses líquidos na data confirmada |
| Despesas pagas | Soma de despesas com paidDate dentro do período |
| Resultado de caixa | Recebido menos despesas pagas; não representa lucro contábil |
| Saldo de clientes | Total das cobranças menos pagamentos aceitos e sinais aplicados; considera todo o histórico |
| Cartão pendente | Parcelas sem receivedDate; líquido é desconhecido se alguma taxa for null |
| Custo de produtos | Consumo pela data e custo registrado no movimento; fica incompleto quando há custo desconhecido |
| Ranking | Frequência de cada serviço selecionado nos atendimentos concluídos do período |
| Atendimentos pendentes | Conversas com status diferente de resolved; inclui waiting |
| Agendamentos a confirmar | Agenda com status pending e data igual ou posterior a hoje |

Cada visita tem um preço total combinado, mesmo com vários serviços. O sistema não divide essa receita artificialmente por serviço. Uma visita com corte e tratamento soma um atendimento, uma ocorrência de corte e uma de tratamento.

Pix e transferência entram no caixa quando registrados, exceto valores marcados como abertura. Cartão aceito reduz a dívida da cliente, mas só entra no caixa quando o repasse líquido é confirmado. Crédito pode ter até 24 parcelas; débito tem um repasse. Taxa desconhecida é null e deve ser conferida; não assumir taxa zero sem confirmação.

Saldo anterior a receber cria cobrança, não receita nova. Sinal de abertura fica disponível sem entrada duplicada. Repasse antigo entra no caixa quando efetivamente confirmado, se recebido no período. Conta antiga do espaço aparece como despesa paga quando ocorrer o pagamento após a abertura.

## Estoque e custo

Unidades suportadas: g, ml e un. qty arredonda para três casas; a interface solicita unidades inteiras para un. packageSize representa o tamanho de uma embalagem, enquanto os movimentos representam quantidade física na unidade do produto. O cadastro inicial não é uma nova compra e não gera saída de caixa.

stockOf reproduz o histórico. Entradas conhecidas recalculam custo médio ponderado: estoque de 100 g a R$ 1,00 por g mais 100 g a R$ 2,00 resulta em 200 g a R$ 1,50 por g. Uma entrada com custo desconhecido em estoque existente mantém o custo como desconhecido. Ao zerar o saldo, o custo é reiniciado; uma nova entrada conhecida pode estabelecer novo custo.

Compra cria movimento positivo e despesa vinculada na mesma cópia do estado. Perda e consumo criam movimentos negativos com custo atual. Valoração altera o custo do saldo atual por movimento de quantidade zero. A valoração posterior não corrige silenciosamente o custo de atendimentos antigos. Movimentos devem respeitar a ordem cronológica por produto; saídas não podem produzir saldo negativo.

No caixa, a compra é saída quando paga. O consumo aparece como informação de custo do atendimento, separado desse caixa. Subtrair ambos novamente ao interpretar resultado de caixa contaria o mesmo desembolso duas vezes.

## Fechamento e sinais

closeAttendance recebe estado e dados do atendimento e retorna nova cópia. Exige data de início, cliente e serviços válidos, preço positivo e data entre início e hoje. Agenda vinculada deve ser da mesma cliente e data, estar disponível e não ter sido concluída. Exige consumo válido ou confirmação explícita de ausência de produtos.

O fechamento valida cada produto, quantidade e data; registra saídas com custo do momento; cria cobrança; aplica sinais disponíveis da cliente; constrói pagamento e parcelas opcionais; cria a ficha e marca a agenda como concluída. Qualquer erro interrompe a operação antes de substituir o estado original. A gravação do snapshot conserva a unidade da operação no servidor.

Um sinal disponível pode ser aplicado uma vez a uma cobrança. A soma dos sinais não pode superar o total, e o pagamento adicional não pode superar o saldo restante. Aplicar ou reter um sinal não recebe dinheiro novamente.

retainDeposit exige confirmação, motivo de até 500 caracteres, sinal disponível e não aplicado. Com agenda ativa vinculada, exige cancelAppointment verdadeiro e cancela o compromisso na mesma cópia. Agenda de outra cliente, concluída, com falta ou inexistente impede a ação. A decisão é manual da profissional; o aplicativo registra a decisão e não define política contratual.

## Interface e eventos

render seleciona a página pelo objeto ui. Telas retornam strings HTML; funções de formulário abrem diálogos em overlay-root. esc é obrigatório para valores do usuário incorporados a HTML. Ações internas definem o próprio markup confiável; não passar texto livre como HTML de botão, atributo extra ou coluna de tabela sem escape.

Eventos em document usam data-action para cliques, data-change para seleção e data-form para envio. Há listeners herdados e listeners v2. O listener legado ignora formulários v2; o moderno trabalha sobre structuredClone, valida e somente então substitui o estado. Não unificar esses listeners sem testar todos os fluxos, pois há ações complementares.

A importação possui prévia em importCandidate e exige confirmação. A interface usa data-indicator para os contadores testados de conversas e agenda. Modo de foco altera a apresentação interna; não agenda notificações nem suspende uma integração externa.

## Importação e exportação

Importação atual: CSV de clientes ou agendamentos, até 100 linhas e 250 KB. O parser aceita vírgula ou ponto e vírgula e aspas escapadas. A prévia confere colunas e associações; não há integração automática com Minha Agenda nem correspondência inteligente garantida de pessoas. Telefones repetidos exigem conferência humana.

Exportação atual: CSV de clientes, agenda, fichas, pagamentos, despesas, estoque ou repasses; cópia completa JSON; impressão pelo navegador, que pode ser salva como PDF. O filtro de datas atua nos registros datados; clientes e estoque representam posição atual, não uma reconstrução histórica por período. Células CSV com prefixos de fórmula recebem proteção. Arquivos fictícios são identificados como exemplos.

Fotos de orçamento: até três JPEG, PNG ou WebP, até 500 KB cada, armazenadas como data URLs dentro do agregado. R2 não está configurado. Não há análise automática da imagem. Muitos anexos podem esgotar o limite total mesmo com imagens individualmente válidas.

## Desenvolvimento e verificação

Requer Node compatível com o package.json e dependências do lockfile. Para o fluxo oficial Sites, utilizar o helper install-dependencies.mjs do plugin quando necessário e build-site.mjs para construir. O comando de desenvolvimento do projeto é npm run dev; o ambiente de preview deve seguir as instruções do Sites. A conexão local com D1 é distinta da produção. Não copiar dados ou credenciais de produção para fixtures.

Comando de testes: node --test tests/*.test.mjs. Os testes de persistência usam node:sqlite, SQLite em memória, o SQL real da migração e um adaptador do contrato D1. Os testes de painel usam DOM mínimo simulado; não substituem avaliação visual em navegador. Nesta revisão documental os 30 testes passaram, a estrutura sintática dos 22 arquivos JS/TS alterados foi comparada com a versão anterior e as regras CSS foram preservadas.

Para publicar, usar o fluxo oficial de abertura, build, preparação do código e save/deploy do Sites preservando a configuração de audiência existente. .openai/hosting.json conserva project_id e binding DB. Não inserir credenciais em código, documentação, URL remota, arquivo exportado ou argumento de shell.

Para mudar o modelo, criar nova migração e estratégia de compatibilidade do schema JSON. Uma mudança no formato do payload também precisa tratar estados já armazenados, não apenas editar db/schema.ts. Um restore de versão do código não equivale a restaurar dados financeiros.

## Limites e evolução

A aplicação é de uso individual, com snapshot integral e edição concorrente otimista. Crescimento de volume pede normalização por entidades, paginação, anexos fora do JSON e uma política de backup e restauração. Auditoria atual informa alterações, mas não implementa histórico completo de valores anteriores nem recuperação de ponto no tempo na interface.

Ainda não implementados: classificação por IA, transcrição, notificações externas, conexão bancária, importação automática do Minha Agenda, XLSX nativo, restauração pela interface e backup automático. Datas de manutenção e prazo de resposta são referências internas, não mensagens programadas.

Valores confirmados e movimentos históricos têm campos protegidos contra alteração por POST comum. Desde a versão 13, DELETE /api/state permite exclusão explícita por plano de dependências confirmado e calculado no servidor. Não há fluxo de estorno, devolução, reconciliação automática ou reversão financeira. Uma correção desse tipo exige evolução específica com novos lançamentos e testes. Excluir não é estornar: a usuária deve conferir os efeitos antes de confirmar.


## Atualização da interface

O menu é dividido em Dia a dia e Gestão, com atalhos móveis para Início, Agenda, Financeiro e Mais. themeControl renderiza o seletor com aria-pressed. O evento v5-theme altera data-theme no elemento html e atualiza os controles sem executar render, preservando campos em edição. Ele pode ser usado durante falha de sincronização porque não altera dados do negócio. O tema inicial é aplicado antes dos estilos e a aparência é lembrada apenas no navegador. public/theme.css centraliza as cores semânticas e possui fallback opaco para ambientes sem backdrop-filter e impressão em fundo claro. A revisão visual usa fixtures locais isoladas, sem escrever em D1. Os arquivos temporários de revisão são removidos antes do pacote de produção. A suíte atual contém 43 testes. A revisão usa cua_repl e o supervisor oficial de preview.


## Histórico mensal e rotina simplificada

`attendanceSummary(state, month)` em public/routine.js filtra uma nova lista de registros sem modificar o snapshot. A identidade do conjunto é a lista ordenada e sem duplicatas de IDs de serviços. O preço é somado em centavos uma única vez por visita; cada procedimento conta individualmente no ranking. O histórico acumulado é calculado sem filtro e permanece disponível na mesma página. Não há rateio de receita por procedimento nem confusão com o valor efetivamente recebido.

`ui.recordsMonth` é um filtro transitório separado do período financeiro. `rollMonth` acompanha a virada quando o filtro mostrava o mês corrente; meses antigos e a consulta completa permanecem selecionados. Nenhum agendamento recorrente do ChatGPT, migração ou rotina de exclusão é criado para mudar o período.

`previousConsumption` consulta a ficha mais recente da mesma cliente e do conjunto exato, limitada à data informada. Em empate de data, prioriza a ficha inserida por último. Usa movimentos de consumo vinculados ao recordId, soma por produto e informa o saldo atual. Uma ficha equivalente sem consumo não provoca busca de uma ficha mais antiga. A função não modifica estoque, valores ou fórmulas.

O formulário de fechamento oferece as visitas em aberto da agenda. Cliente e data vinculados são preservados, o serviço vem selecionado e duração/intervalo são exibidos. O usuário ainda confere todos os procedimentos e o preço total. Aplicar a sugestão de produtos é uma ação explícita que só preenche o formulário, requer conferência e continua sujeita à validação de estoque no fechamento atômico. `fillPaymentRest` preenche total menos sinais selecionados, sem confirmar o pagamento.

`ensureSpaceExpense` devolve o estado original sem alteração quando falta configuração ou o recurringMonth já existe. Caso contrário, cria uma cópia com a conta do mês atual em aberto. Exige início confirmado e não futuro, valor finito positivo e vencimento entre 1 e 28. O ID determinístico auto-space-AAAA-MM e o recurringMonth evitam duplicações no cliente; o controle de revisão da API impede gravações concorrentes do mesmo snapshot. A data de registro é o primeiro dia do mês ou a data de início, o que for posterior. O vencimento mantém o dia configurado, inclusive se já estiver vencido ao abrir a operação.

A conferência ocorre após bootstrap, ao retomar a janela/aba e a cada minuto enquanto visível. A preparação pode criar a conta no mesmo snapshot das configurações. Não há execução com o site fechado, preenchimento retroativo de meses pulados, alteração de contas existentes ou confirmação automática de pagamento. Em erro ou conflito de sincronização, novas ações automáticas ficam suspensas. Contas de outros meses continuam disponíveis no fluxo manual secundário.

## Interface e leitura no celular

`dashboardIntro` mostra a capa com data de Brasília, visitas de hoje e conclusões da agenda. `agendaOverview` soma visitas, conclusões e duração sem intervalos. `pageGuide` explica ações e cálculos em um details acessível de cada página. `adaptTables` acrescenta data-label derivado do cabeçalho às células; a folha atelier.css reorganiza as linhas como cartões no celular, preservando os dados. Não cria outro conjunto de registros nem altera a tabela no banco.

public/atelier.css é a última camada da cascata e define superfícies, navegação, capa, indicadores, agenda, históricos, listas, cadastros e formulários. Os dois temas usam as mesmas variáveis semânticas. O projeto continua usando o catálogo SVG local e as fontes já existentes. Ver SISTEMA_VISUAL.md para a intenção e os critérios de manutenção.

Validação desta revisão: 43 testes de domínio, API, histórico, pendências e tema; teste da API em SQLite em memória; fechamento de visita fictícia em navegador com conferência de sugestão, estoque e pagamento; geração automática de despesa em aberto; revisão das páginas no celular e dos temas claro/escuro. O preview visual usa API simulada e dados fictícios; a persistência e a concorrência são verificadas pelos testes do handler real. O pacote de produção exclui os arquivos temporários de preview.


## Procedimentos por dia e navegação entre registros

`public/navigation.js` centraliza `destinationHref`, `parseDestination`, `validCalendarDate`, `recordsForView` e `recordPage`. A lista e os indicadores usam a mesma seleção em memória sobre o snapshot completo da API. Modos: day (padrão, data civil atual), month e all. Os filtros adicionais são serviço participante, conjunto exato ordenado e cliente. Paginação de 10 registros com limites e página ajustados; nenhuma dessas consultas altera estado de negócio.

`public/destinations-ui.js` recebe o contexto compartilhado do aplicativo e monta detalhes de consulta de atendimento, cobrança, pagamento, repasse e despesa. Links usam IDs existentes para vincular ficha, cliente, agenda, produtos e recebimentos. Consulta não chama persist nem confirma operações. Formulários existentes continuam responsáveis por qualquer alteração.

`navigateTo` em `app.js` aplica filtros, renderiza e atualiza hash/histórico. `history.state` contém somente contexto visual e rolagem, sem snapshot financeiro. `popstate` restaura filtros e detalhes. URLs aceitam apenas uma lista explícita de páginas e parâmetros; dados pessoais livres e comandos financeiros ficam fora da URL. Links podem ser abertos em outra aba, mas continuam sujeitos à autenticação e à base selecionada.

`closeModal` e `confirmLeaving` preservam a edição quando a pessoa opta por continuar. O formulário é passado explicitamente a `persist` para limpar a marca de edição apenas após aceitação do snapshot pela fila. `validateVisibleControls` mantém restrições HTML sem balões nativos, com mensagem em português e associação ao campo; domínio e API continuam validando a operação. Diálogos de consulta não modificam valores.

Indicadores de saldo abrem todas as pendências correspondentes; indicadores de recebimentos e despesas pagas aplicam o período financeiro. Resultado de caixa abre entradas e saídas pagas. Consumo abre movimentos vinculados às fichas. Receita continua sendo contada uma vez por visita/conjunto, e frequência uma vez por serviço na visita, sem rateio inventado.

Referências de comportamento e visual: `UX-CONTRACT.md` e `DESIGN.md`.


## Cadastro de cliente no agendamento

`public/booking.js` centraliza `phoneKey`, `matchingClient`, `validateClientContact`, `validateBookingSlot` e `createBooking`. `createBooking` valida o horário, clona o snapshot, acrescenta o cliente opcional e o agendamento, verifica referências e chama `validateState` antes de devolver o novo estado. A API recebe as duas coleções no mesmo POST com revisão/CAS; não existe uma gravação intermediária de cliente.

O formulário usa um único diálogo e alterna seções com `hidden` e `disabled`. Campos digitados permanecem no DOM ao trocar entre cliente novo e existente. Validadores ignoram controles desabilitados; as regras de contato são reutilizadas no cadastro completo. Um telefone coincidente oferece associação explícita, sem fusão automática. Para números brasileiros de 12/13 dígitos começados em 55, a comparação remove somente o DDI; o número informado é preservado no registro.

`validateAppointment` delega ao mesmo `validateBookingSlot` usado na criação, preservando expediente, folgas e conflito com intervalo. Bloqueios continuam sem cliente.


## Canal WhatsApp

`lib/whatsapp-handler.mjs` implementa as rotas autenticadas de conexão, caixa, envio e mídia, a sincronização pública do conector Baileys (autenticada pela chave do conector) e o webhook HMAC da Meta. `lib/whatsapp-domain.mjs` concentra cifragem, janela, identidade e validação de mídia; `lib/meta-cloud.mjs` implementa o transporte oficial da Meta. `public/whatsapp.js` preserva rascunhos por conversa e usa os primitivos de interface compartilhados. As tabelas `wa_*` do canal são independentes do snapshot financeiro.

Provedor na tela: **Baileys** em modo "o conector chama o site". O processo Node em `services/baileys` roda no computador do ateliê e sincroniza por `POST /api/whatsapp/bridge/sync` (Bearer com a chave do conector), sem porta, túnel ou domínio. A migração 0004 cria `wa_bridge` (hash da chave, estado e comando pendente) e `wa_outbox` (fila de envio). Anexos ficam no Workers KV (`MEDIA`). Rotas, estados e limites: `INTEGRACAO_BAILEYS.md`.

A API oficial da Meta continua no servidor, testada, sem botão na tela atual (`INTEGRACAO_WHATSAPP.md`). A migração 0002 adicionou o provedor e os marcos verificáveis de recebimento da Meta. O adaptador YCloud foi removido em 30/10/2026.

## Exclusões

public/deletion.js centraliza bloqueios e preparação de exclusão. domain.validateState aplica os mesmos bloqueios à versão anterior, inclusive em POST direto na API. A exclusão usa CAS, fila, auditoria e recuperação existentes. O POST comum mantém a imutabilidade; o DELETE confirmado aplica a cascata validada. Ver `EXCLUSAO_REGISTROS.md`.


## Versão 13 — autenticação e ciclo de exclusão

`lib/salon-auth.mjs` usa PBKDF2/SHA-256, sal aleatório e 100.000 iterações, compatíveis com Web Crypto no Worker. Senhas de criação e recuperação têm no mínimo 12 caracteres. Sessões usam 32 bytes aleatórios, persistem apenas SHA-256 do token na D1 e cookie __Host-hanne-session com Secure, HttpOnly, SameSite=Strict, Path=/ e duração de 12 horas. A recuperação pela identidade da titular revoga todas as sessões anteriores. Não há envio de recuperação por e-mail; trocar a titular requer migração administrativa explícita. A identidade está associada à titular original deste Site. Limite de login: 10 tentativas por origem IP em 15 minutos. API de autenticação e operações de escrita verificam mesma origem.

Os adaptadores de estado e WhatsApp resolvem a sessão no servidor antes de chamar handlers de negócio. O mapeamento aponta para a mesma conta proprietária que já guarda os registros. Webhooks externos mantêm assinatura e deduplicação próprias, sem exigir sessão de visitante. A autenticação da plataforma é preservada para bootstrap/recuperação; após configurar credenciais, ela não substitui o login operacional.

`deletionPlan` calcula fechamento transitivo de referências e operações atômicas: ficha/cobrança, parcela/pagamento e compra/despesa/movimento. Entradas retiradas arrastam movimentos posteriores do mesmo produto; saídas restantes têm custo médio recalculado. DELETE /api/state exige revisão, confirmed=true e a lista serializada dos vínculos vistos pela usuária. O servidor ignora snapshots fornecidos no DELETE, recalcula o plano, valida o estado final e grava em batch com revisão otimista e evento. A exclusão de uma despesa recorrente registra skippedSpaceMonths para não regenerar aquele mês. A base de exemplos continua isolada.

Mensagens apagadas são redigidas (body vazio, media e error nulos, type=deleted) e não aparecem nas consultas. IDs de transporte e tentativas são preservados para idempotência. Excluir uma conversa remove o contato local e limpa o conteúdo de suas mensagens; não é um revoke no WhatsApp e não apaga mídia física do conector. Envios sending/uncertain exigem conferência antes da remoção. Os registros técnicos de auditoria persistem; excluir a entrada visível do histórico não é purga completa de backups ou metadados.

