# Verificação da consulta diária e dos destinos relacionados

Revisão de 20/10/2026. Escopo: consulta de procedimentos, atalhos entre entidades e proprietários compartilhados de navegação/diálogo.

## Verificações automatizadas

- `node --test tests/*.test.mjs`: 48 testes passaram, incluindo filtro diário/mensal/histórico, conjunto exato, preço sem rateio, paginação, invariantes de domínio e persistência.
- `npm run lint`: saída 0, sem erros; 7 avisos preexistentes de imports/variáveis não usados e recomendações Next para esta interface vanilla.
- `node_modules/.bin/tsc --noEmit --incremental false`: saída 0.
- `git diff --check`: saída 0.
- `npx --yes --package @google/design.md designmd lint DESIGN.md`: saída 0; sem erros, 5 avisos de tokens sem referência no frontmatter. O modelo documentado é runtime canônico, sem geração de CSS.
- Build de produção: etapa obrigatória do pacote por `node /root/.codex/plugins/cache/openai-curated-remote/sites/1.1.0/scripts/build-site.mjs`. O helper só sincroniza e empacota depois da conclusão com sucesso; o resultado nativo de implantação é a evidência final da entrega.

## Auditoria estática

Comando: `python /workspace/scratch/327aea64f6ae/daily-work/audit_project.py /workspace/sites/hanne-atelier --mode strict --output docs/AUDITORIA_PROCEDIMENTOS.json`. O script é o fornecido pelo plugin frontend-design-premium 1.4.0, sem alterações.

O auditor genérico classifica botões com eventos delegados como sem ação porque reconhece onclick, @click e v-on:click, mas não data-action. Foram revisados os 20 achados: todos estão em public/app.js, possuem data-action e handlers delegados do aplicativo. Não se acrescentou onclick artificial para contornar o verificador. O JSON bruto conserva os 20 achados e a saída estrita é 1; ela não é apresentada como aprovação automática. Formulários, date/select, scrollbar, contrato e destinos sem href real não apresentaram outros achados após criação desta evidência.

## Navegador

Prévia gerenciada com módulos reais da aplicação e API fictícia temporária, sem acesso a dados de produção:

- Hoje com uma visita fictícia; mês com 13 visitas; paginação 1–10 e 11–13; Voltar recupera a primeira página.
- Mês vazio e base vazia com 0–0; acumulado continua independente do filtro. Filtro por serviço e histórico preservam os registros.
- Teclado Enter abre a ficha; Escape fecha e devolve foco ao link Ver atendimento.
- Ficha → cobrança → pagamento; cobrança → agenda concluída; pagamento do cartão → parcelas. Consulta não dispara gravações.
- Formulário com valor inválido preserva entrada e apresenta erro associado; edição pode ser retomada depois da confirmação de descarte. Pagamento fictício válido fecha e confirma sincronização.
- Falha simulada 503 mantém alteração pendente e exibe Tentar salvar / Exportar rascunho. Nova tentativa confirma a gravação.
- Carregamento de 5 segundos mostra Preparando seu espaço privado antes da consulta.
- Viewports lógicos de aproximadamente 380 e 325px sem overflow horizontal; ficha longa no escuro permanece dentro da viewport. Tema claro também revisado. Scrollbar computada usa tokens globais.

## Limites e contexto

A inspeção foi em Chromium na prévia; não é certificação WCAG, teste completo de zoom, leitor de tela ou teclado virtual de aparelhos físicos. Os popups nativos de date/month/select pertencem ao navegador e podem usar o idioma do sistema, conforme decisão explícita no UX-CONTRACT. A seleção nativa de pagamento e a exibição condicional dos campos de cartão foram verificadas; a captura do navegador remoto não expôs visualmente o popup aberto. Reduced motion e forced colors preservam caminhos CSS próprios; não houve emulação de todas as plataformas. Testes de API com mocks cobrem conflitos e isolamento; a QA visual não altera nem revalida dados reais da Hanne. A implantação nativa confirma a publicação.

Preço por conjunto, saldos, cartão, sinais, compra e consumo continuam regidos por public/domain.js e pela documentação técnica. Nenhum fluxo de exclusão financeira ou nova audiência foi criado.
