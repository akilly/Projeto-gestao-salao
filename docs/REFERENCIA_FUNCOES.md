# Referência das funções

As funções abaixo estão comentadas junto à implementação. A lista cobre as funções de aplicação e os utilitários de negócio; funções internas locais seguem o contexto do bloco que as contém.

## public/app.js

- `icon`: Produz o SVG de um ícone do catálogo local, com alternativa para nome desconhecido.
- `esc`: Escapa texto inserido em HTML e atributos para impedir que dados do usuário sejam interpretados como marcação.
- `money`: Formata valores em reais para leitura na interface; não realiza cálculo financeiro.
- `fmt`: Formata uma data ISO ao meio-dia para exibição em português.
- `longDate`: Exibe a data por extenso com dia da semana.
- `initials`: Extrai até duas iniciais do nome para o avatar.
- `uid`: Gera um identificador único para um novo registro.
- `stateURL`: Escolhe a API da base real ou da demonstração sem misturar os registros.
- `client`: Localiza a cliente no estado atual; devolve rótulo de bloqueio quando não há vínculo.
- `service`: Localiza o serviço ou os dados padrão de um bloqueio de agenda.
- `avatar`: Renderiza o avatar com nome e cor escapados.
- `pill`: Renderiza uma etiqueta visual de texto com indicador opcional.
- `btn`: Monta botão com ação delegada por data-action; o conteúdo de texto é definido pelos chamadores.
- `iconBtn`: Monta botão de ícone com nome acessível e atributos auxiliares.
- `empty`: Renderiza uma mensagem de lista vazia.
- `pendingConvs`: Conta como pendente toda conversa que ainda não está resolvida, inclusive as que aguardam retorno.
- `activeAppts`: Seleciona e ordena compromissos do dia, excluindo cancelamentos e faltas.
- `categoryColor`: Associa a categoria de atendimento a uma cor de prioridade.
- `toast`: Exibe uma confirmação temporária e substitui o temporizador anterior.
- `persist`: Solicita gravação do estado atual; a fila central controla validação e concorrência.
- `audit`: Registra a intenção da alteração para a próxima gravação auditada pelo servidor.
- `go`: Troca a página e reinicia elementos temporários de navegação.
- `render`: Reconstrói a estrutura da interface a partir do estado e dos filtros atuais.
- `heading`: Monta o título de uma página com subtítulo e ações.
- `stat`: Renderiza um indicador numérico do painel.
- `conversationRow`: Renderiza uma conversa com situação, prioridade e cliente.
- `dayRibbon`: Monta a faixa de datas navegáveis da agenda.
- `scheduleRow`: Renderiza um compromisso ou bloqueio com suas ações.
- `clientsPage`: Renderiza clientes conforme busca, filtro e modo de visualização.
- `conversationsPage`: Seleciona WhatsApp real ou notas internas. `manualConversationsPage` conserva as anotações.
- `agendaPage`: Renderiza a agenda diária ou de cinco dias.
- `availableSlots`: Calcula sugestões de horários respeitando expediente, dias fechados e conflitos com intervalo.
- `quotesPage`: Renderiza orçamentos manuais por situação.
- `servicesPage`: Renderiza catálogo de serviços e fichas de atendimentos.
- `tasksPage`: Renderiza tarefas abertas ou concluídas com seus filtros.
- `renderPage`: Seleciona a função de renderização da página ativa.
- `modal`: Abre o contêiner de diálogo com o conteúdo recebido.
- `closeModal`: Fecha o diálogo e limpa a área de sobreposição.
- `openForm`: Monta e abre um formulário padronizado com corpo, identificador, mensagens de erro e ações de salvar ou cancelar.
- `field`: Monta o campo de formulário com rótulo e indicação opcional.
- `textfield`: Monta um campo de texto de várias linhas com conteúdo escapado.
- `selectField`: Monta seleção com rótulo e opções fornecidas pelo chamador.
- `clientOptions`: Monta pares de identificador e nome das clientes para os seletores; identifica cadastros temporários.
- `serviceOptions`: Monta as opções do catálogo de serviços.
- `clientForm`: Abre cadastro ou edição de cliente e confirma o tipo de cadastro.
- `profile`: Exibe ficha de cliente e seus vínculos com agenda, financeiro e histórico.
- `appointmentForm`: Abre agendamento com duração e intervalo do serviço.
- `appointmentDetail`: Mostra os detalhes e as ações manuais de um agendamento.
- `reschedule`: Abre alteração de data e horário sem criar outro compromisso.
- `serviceForm`: Abre edição dos dados técnicos e do tempo de um serviço.
- `updateRecordRequired`: Ajusta campos técnicos obrigatórios do formulário legado de ficha; o fechamento atual usa o fluxo em etapas.
- `quoteForm`: Abre orçamento com valor, avaliação e até três fotos locais.
- `photoMarkup`: Renderiza prévias das fotos do orçamento mantidas temporariamente em memória.
- `billForm`: Abre lançamento manual de valor a receber de uma cliente.
- `taskForm`: Abre cadastro ou edição de tarefa interna.
- `reviewDraft`: Permite revisar um texto de resposta antes de copiá-lo; não envia mensagens.
- `copyText`: Copia texto para a área de transferência e informa o resultado.
- `exportModal`: Abre seleção de categoria, período e formato de exportação.
- `legacyExportRows`: Mantém o mapeamento de exportação anterior; o fluxo atual utiliza exportRows.
- `download`: Cria e descarrega arquivo no navegador, liberando a URL temporária.
- `exportData`: Gera CSV, cópia JSON ou impressão conforme seleção; identifica dados fictícios.
- `importTemplate`: Descarrega modelo CSV para clientes ou agendamentos.
- `importModal`: Abre a seleção do CSV e o processo de conferência antes de importar.
- `validCalendarDate`: Verifica datas civis pelo módulo navigation.js.
- `validateAppointment`: Valida expediente, folgas, duração e conflitos antes de alterar a agenda.
- `alerts`: Monta alertas internos do painel; não produz notificações externas.
- `searchModal`: Abre a pesquisa global por registros.
- `searchResults`: Monta resultados da busca conforme o texto informado.
- `redrawInput`: Atualiza resultados de campo sem perder posição de digitação.
- `prepareImport`: Lê e valida o CSV com limite de linhas e prepara vínculos para conferência manual.
- `confirmImport`: Aplica somente a importação revisada e solicita sua persistência.
- `syncBanner`: Exibe carregamento, erro de gravação ou conflito e suas opções de recuperação.
- `queueSave`: Valida o estado e sinaliza que há uma versão pendente para a fila de gravação.
- `flushSave`: Serializa POSTs com revisão otimista; atualiza a confirmação ou interrompe edições em caso de conflito.
- `bootstrap`: Carrega a base selecionada da API e inicia a interface autenticada.
- `stockNumber`: Formata quantidade de estoque com até três casas decimais.
- `viewPeriod`: Converte o mês selecionado ou todo o histórico em limites de data.
- `periodToolbar`: Renderiza os controles do período financeiro.
- `setupNotice`: Mostra aviso quando ainda falta confirmar o início da operação.
- `cashChart`: Agrupa entradas e saídas para o gráfico de caixa do período.
- `attentionSummary`: Renderiza contadores distintos de conversas pendentes e agendamentos a confirmar.
- `dashboard`: Monta o painel com pendências, caixa, frequência de serviços e alertas de estoque.
- `financePage`: Renderiza indicadores do período e abas de dívidas, repasses, sinais, despesas e recebimentos.
- `table`: Renderiza tabela reutilizável com cabeçalhos e linhas fornecidos.
- `inventoryPage`: Renderiza produtos, saldos calculados e movimentos de estoque.
- `moneyPrecise`: Exibe custo unitário com precisão adicional para produtos fracionados.
- `setupPage`: Renderiza data de início, participação fixa do espaço e saldos de abertura.
- `settingsPage`: Renderiza preferências, expediente e opções manuais de dados e auditoria.
- `help`: Exibe orientação resumida e limitações da operação atual.
- `requireStarted`: Impede registros operacionais antes da confirmação da data de início.
- `cardFields`: Monta parcelas, primeiro vencimento e taxa para pagamentos em cartão.
- `updateCardFields`: Ajusta a visibilidade e as restrições dos campos conforme o método de recebimento.
- `paymentForm`: Abre recebimento parcial ou total de uma dívida existente.
- `depositForm`: Abre registro de sinal disponível para uma cliente e vínculo opcional com agenda.
- `productForm`: Abre cadastro de produto com unidade, embalagem, estoque inicial e custo conhecido ou pendente.
- `purchaseForm`: Abre compra que produzirá entrada de estoque e despesa vinculada.
- `productDetail`: Exibe saldo, custo e histórico de movimentos do produto.
- `movementForm`: Abre perda de estoque ou conferência de custo, sem reescrever o histórico.
- `expenseForm`: Abre despesa de espaço, produto ou descartável e confirmação opcional de pagamento.
- `openingForm`: Abre saldo anterior de cliente, sinal, cartão ou conta do espaço.
- `settleForm`: Abre confirmação de repasse do cartão com valor líquido e data efetivos.
- `retainForm`: Exige motivo e confirmação para reter sinal e, quando necessário, cancelar o agendamento vinculado.
- `recurringForm`: Abre geração manual da conta mensal do espaço, impedindo duplicidade por mês.
- `billDetail`: Exibe composição do valor cobrado, pagamentos aceitos e saldo da cliente.
- `recordForm`: Abre a edição de anotações da ficha; campos financeiros do fechamento permanecem protegidos.
- `finishForm`: Abre fechamento em três etapas para serviços, consumo e recebimento.
- `depositChecks`: Monta seleção de sinais ainda disponíveis da cliente no fechamento.
- `showFinishStep`: Atualiza a etapa visível sem concluir ou gravar o atendimento.
- `checkFinishStep`: Confere os campos necessários antes de avançar na conclusão do atendimento.
- `exportRows`: Mapeia entidades atuais para colunas de exportação e respeita os filtros aplicáveis.
- `datasetBanner`: Identifica claramente se a visualização é real ou fictícia.

## public/core.js

- `localDate`: Retorna AAAA-MM-DD no fuso America/Sao_Paulo, usado como hoje nas regras do negócio.
- `dayOffset`: Soma dias de calendário a uma data ISO usando meio-dia para evitar viradas próximas da meia-noite.
- `minutes`: Converte HH:MM em minutos desde o início do dia.
- `clock`: Converte minutos em HH:MM para a agenda.
- `appointmentConflict`: Retorna o primeiro compromisso sobreposto na mesma data, incluindo o intervalo; ignora o próprio ID, cancelamentos e faltas.
- `receivedFor`: Soma valores aceitos ligados à cobrança no modelo legado; não mede entrada efetiva de caixa de cartão.
- `balanceFor`: Calcula saldo da cobrança no modelo legado, limitado a zero.
- `parseCSV`: Lê CSV separado por vírgula ou ponto e vírgula, preservando delimitadores e quebras em campos entre aspas; rejeita aspas sem fechamento.
- `csvCell`: Escapa aspas e neutraliza prefixos de fórmula ao exportar uma célula CSV.
- `demoState`: Cria fixtures históricas de demonstração e catálogo inicial; não deve ser gravado diretamente como operação real.

## public/domain.js

- `cents`: Converte reais em centavos inteiros para arredondamento monetário.
- `amount`: Converte centavos inteiros em reais.
- `qty`: Arredonda quantidade de produto para três casas decimais.
- `cardMethod`: Identifica métodos que geram agenda de repasses da operadora.
- `blankState`: Cria estado schema 2 sem histórico de negócio; inclui sugestões editáveis de serviços.
- `plusMonths`: Soma meses preservando o dia quando possível e limitando ao último dia do mês de destino.
- `splitCents`: Divide valor em parcelas sem perder centavos, distribuindo o resto nas primeiras parcelas.
- `stockOf`: Reconstitui saldo e custo médio ponderado na ordem dos movimentos. Custo desconhecido permanece null até valoração ou renovação integral do estoque.
- `billPaid`: Soma pagamentos aceitos da cobrança; cartão reduz dívida da cliente antes do repasse. Sinal retido não é pagamento aplicado.
- `billBalance`: Calcula o saldo devedor da cliente em centavos, sem valores negativos.
- `availableDeposits`: Seleciona sinais disponíveis da cliente que ainda não foram aplicados a uma cobrança.
- `paymentEntries`: Constrói pagamento e parcelas, sem alterar o estado recebido. Aceita de 1 a 24 parcelas, débito apenas uma; taxa null significa desconhecida.
- `periodOf`: Obtém limites inclusivos do mês ou de todo o histórico quando não há mês.
- `metrics`: Calcula caixa por recebimento efetivo e despesa paga; separa preço dos atendimentos, dívida das clientes, cartões pendentes e custo de consumo. Pendências abrangem todo o histórico.
- `closeAttendance`: Cria uma cópia e conclui atendimento, consumo, cobrança, sinais e pagamento juntos. Qualquer erro descarta a cópia e preserva o estado original.
- `retainDeposit`: Cria uma cópia para reter sinal disponível e cancelar agenda ativa vinculada com consentimento explícito. Não gera nova entrada de caixa.
- `validateState`: Valida estrutura, referências, valores, datas, estoque cronológico e imutabilidade do histórico confirmado. Lança erro no primeiro problema; usada no cliente e no servidor.

## public/examples.js

- `exampleState`: Constrói demonstração isolada com clientes, estoque, atendimentos, sinais e cartões coerentes com as mesmas regras de domínio; valida o resultado antes de retornar.

## lib/state-handler.mjs

- `response`: Produz resposta JSON privada sem cache e com proteção contra interpretação incorreta de MIME.
- `handleStateRequest`: Atende leitura e gravação do agregado em D1: autentica, separa bases, valida e grava por revisão otimista junto com auditoria. Não confia no estado enviado pelo navegador.

## app/route.ts

- `GET`: Autentica o acesso e entrega a página HTML do sistema.

## app/api/state/route.ts

- `GET`: Encaminha a requisição ao handler de estado e ao banco D1.
- `POST`: Encaminha a requisição ao handler de estado e ao banco D1.

## app/layout.tsx



## db/schema.ts



## lib/salon-auth.mjs

- `salonIdentity`: devolve o `owner_id` da sessão, só para conta existente e ativa.
- `authorizeRequest`: recria uma requisição compatível com o Worker e injeta a identidade da sessão para os handlers protegidos.
- `confirmPassword`: confere a senha da conta da sessão antes de exclusões.
- `handleAuth`: atende status, cadastro inicial, login, saída, recuperação, troca de senha/e-mail e, para a titular, `users`, `invite`, `cancel-invite` e `user-access`.
- `createAccount` / `setPassword`: cria a conta (titular ou convidada) / grava senha nova e encerra as sessões daquela conta.
- `issueLink` / `consumeLink`: link de uso único (só o hash fica no banco; o anterior do mesmo tipo e e-mail deixa de valer).
- `derive`, `digest` e `timingEqual`: derivam e comparam credenciais sem armazenar senha em texto puro.

## public/form-validation.js

- `validateVisibleControls`: apresenta erro inline, associa a mensagem ao campo inválido e move o foco sem abrir balões nativos.


## public/theme.js

- `preferredTheme`: recupera claro ou escuro da preferência local; valor ausente, inválido ou bloqueado volta para claro.
- `applyTheme`: altera a aparência no documento e tenta persistir somente a escolha visual.

## Seletor de aparência em public/app.js

- `themeControl`: renderiza opções de tema com nomes acessíveis e estado pressionado explícito.


## Histórico, automação e interface revisada

### public/routine.js

- `attendanceSummary`: filtra a visualização mensal, soma preços em centavos por visita, agrupa conjuntos e conta cada procedimento separadamente.
- `rollMonth`: avança o filtro apenas quando ele seguia o mês corrente.
- `previousConsumption`: consulta a ficha anterior compatível sem alterar estoque ou ficha técnica.
- `ensureSpaceExpense`: cria uma única conta do espaço em aberto para o mês atual quando a configuração estiver completa.

### public/app.js

- `pageGuide`: fornece explicações de cada tela em um painel expansível acessível.
- `refreshRoutine`: acompanha o calendário e solicita a gravação da despesa atual quando apropriado; suspende ações durante falha, conflito ou gravação.
- `adaptTables`: associa os cabeçalhos às células para apresentá-las como cartões no celular.
- `dashboardIntro`: apresenta a capa do painel com quantidades reais da agenda.
- `agendaOverview`: resume visitas, conclusões e tempo reservado do dia selecionado.
- `updateFinishRequirements`: aplica requisitos técnicos também aos serviços preenchidos pela agenda.
- `consumptionForForm`: obtém o contexto atual para buscar a referência de consumo.
- `updateConsumptionSuggestion`: apresenta uma referência histórica sem preencher ou consumir produtos automaticamente.
- `applyConsumptionSuggestion`: copia quantidades por ação explícita e exige conferência antes da conclusão.
- `fillPaymentRest`: preenche o pagamento sugerido com o total menos os sinais selecionados.

`finishForm` agora oferece escolha de agendamentos em aberto ou fechamento sem agenda. `servicesPage` abre o histórico mensal e mostra métricas acumuladas com preço por conjunto. `recurringForm` permanece como opção secundária para contas de outros meses.


## Consulta de procedimentos e vínculos

| Função | Responsabilidade |
| --- | --- |
| destinationHref / parseDestination | Serializar e ler destinos internos com parâmetros permitidos |
| validCalendarDate | Recusar datas civis inexistentes |
| recordsForView | Consultar registros sem alterar a base |
| recordPage | Limitar página e devolver linhas, total e intervalo |
| destinationLink / navigateTo | Reutilizar âncoras reais e preservar o contexto da consulta |
| currentDestination / openDestinationDetail | Identificar a lista proprietária e abrir o detalhe relacionado |
| detailViews | Montar fichas de consulta reutilizando formatadores e modal |
| confirmLeaving / restoreEditing | Confirmar descarte e preservar o formulário original quando cancelado |
| validateVisibleControls | Validar campos visíveis sem balão nativo, associando mensagem e foco |


## Cadastro durante a reserva

- `phoneKey` / `matchingClient`: comparar números brasileiros com e sem +55 e sugerir cadastro existente, sem unir dados.
- `validateClientContact`: mesma validação para cadastro completo e formulário da agenda.
- `validateBookingSlot`: validar data civil, expediente, folgas, duração e conflito com intervalo.
- `createBooking`: devolver cliente opcional e reserva em um único snapshot validado, sem mutar a entrada.
- `setBookingClientMode`: alternar seções preservando os valores do formulário e posicionando foco.
- `showBookingClientMatch`: apresentar a coincidência de telefone e uma escolha manual de associação.


## Canal WhatsApp

- `handleWhatsApp`: autoriza e despacha configuração, conversas, envio, mídia, sincronização do conector e webhook da Meta.
- `send`: valida arquivo e tentativa; Baileys coloca na fila (`wa_outbox`), Meta despacha dentro da janela de 24 h. Nunca repete sozinho.
- `processChannelEvent`: grava eventos normalizados de qualquer provedor com deduplicação atômica.
- `encrypt/decrypt`: AES-GCM com vínculo à conta.
- `windowOpen/peerOf/phone/validateMedia/mediaMime`: prazo, identidade, telefone e anexos.
- `createWhatsAppUI`: caixa, compositor, rascunhos, paginação, polling e conexão; reutiliza diálogos/campos/toast do aplicativo.

## Conector Baileys (lado do site)

- `connectBaileys`: guarda o hash e a cifra da chave do conector e agenda o comando `pair`.
- `describeBaileys`: estado lido do banco (online, QR, número), com orientação quando o conector não aparece.
- `bridgeSync`: recebe status/QR/eventos/resultados e devolve confirmações, fila e comandos.
- `bridgeMediaUpload/bridgeOutboxMedia`: anexos recebidos e a enviar no Workers KV.

## Conector Baileys (computador do ateliê, `services/baileys`)

- `sync/loop`: ciclo de sincronização com intervalo indicado pelo site.
- `start/logout`: abre, retoma ou encerra a sessão do WhatsApp.
- `receive/uploadMedia`: guarda mensagens recebidas e envia o anexo antes do evento.
- `sendItem`: envia um item da fila com diário anti-duplicação.
- `openStore` (`store.mjs`): diário SQLite de envios, eventos e número esperado.


## Conexão direta Meta

- `connectMeta`: confere token, Phone number ID e WABA; cifra token/segredo, sem registrar ou migrar número.
- `subscribeMeta`: solicita callback exclusivo e conserva erro/etapas para retomada.
- `metaWebhook`: atende desafio GET e valida HMAC de eventos POST.
- `processChannelEvent`: persiste eventos autenticados com deduplicação atômica, independentemente do provedor.
- `metaRequest/metaErrorReason`: transporte oficial e orientações de erro sem expor credenciais.
- `normalizeMetaEvents/verifyMetaSignature/safeMetaMediaURL`: tradução, autenticidade e limite do download.
- `setupPanel`: mostra confirmações observadas e valores de callback do titular; não simula QR ou recebimento real.


## Inteligência artificial (`lib/ai.mjs`)

- `classify`: categoria e prioridade, sempre dentro da lista; segurança é sempre prioridade alta.
- `summarize` / `suggestReply`: resumo curto e rascunho de resposta com o contexto da cliente.
- `normalizeMessages`: limita o histórico (20 mensagens, 6.000 caracteres) mantendo o final.
- `takeQuota`: contador diário por salão e tarefa (`ai_usage`).
- `handleAI`: rota `/api/ai/*` (sessão, origem, cota, erros amigáveis).
- `classifyPending` (`lib/whatsapp-handler.mjs`): classifica até 2 conversas com mensagem nova a cada consulta da lista.
- Interface: `aiRun`, `aiContext`, `aiNote` (`public/app.js`) e `runAI` (`public/whatsapp.js`).

## Conta

- `changePassword` (`lib/salon-auth.mjs`): troca com a senha atual, encerra as outras sessões e renova a atual.
- `passwordForm` (`public/app.js`): janela de troca de senha em Configurações → Sua conta.
- `changeEmail` / `confirmEmail` (`lib/salon-auth.mjs`): troca de e-mail com a senha atual; com e-mail configurado, só vale após o link enviado ao novo endereço.
- `emailForm`, `inviteForm`, `inviteLinkModal`, `salonsSection`, `loadSalons`, `authPost` (`public/app.js`): troca de e-mail e gestão dos salões pela titular.
