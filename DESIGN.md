---
version: alpha
name: Hanne Ateliê
description: Gestão cotidiana do ateliê com papel claro, ameixa, cereja e vidro discreto.
colors:
  primary: "#78469c"
  accent: "#74459a"
  danger: "#b64160"
  background: "#f7f5f8"
  text: "#292333"
  dark-background: "#2c2834"
  dark-text: "#f5f0f8"
typography:
  sans:
    fontFamily: "DM Sans, system-ui, sans-serif"
rounded:
  DEFAULT: "20px"
  sm: "8px"
  md: "12px"
spacing:
  sidebar-width: "232px"
  page-max: "1580px"
components:
  button: {}
  card: {}
  dialog: {}
  table: {}
  field: {}
---

# Hanne Ateliê Design System

## Overview

### Creative North Star

Uma agenda de ateliê sobre papel claro: organização calma, acentos de ameixa e superfícies que lembram vidro fosco. A expressão aparece no resumo do dia; tabelas e valores priorizam leitura.

### Product context and register

Hanne registra atendimentos logo após cada visita, principalmente pelo celular. O produto é uma ferramenta de operação, com linguagem simples em português brasileiro. O contexto de Pix, reais, agenda e espaço compartilhado vem do histórico de requisitos e de `docs/DOCUMENTACAO_TECNICA.md`. Não há escopo japonês ou multilíngue. Evitar telas quase pretas, excesso de vidro, tipografia ornamental em valores e controles sem destino.

O registro é de produto. O catálogo não pressupõe preços individuais: a visita tem um preço pelo conjunto. Preservar os componentes e significados entre Agenda, Serviços, Financeiro e Estoque.

**Propriedade dos tokens:** modelo de runtime canônico. `public/atelier.css` é a camada final de cores, estados e ajustes responsivos sobre `public/style.css` e `public/theme.css`. Este documento espelha essa implementação; não gera CSS. `docs/SISTEMA_VISUAL.md` conserva a referência detalhada. Mudanças visuais devem atualizar as duas referências e verificar os temas no navegador.

## Colors

Os tokens do frontmatter descrevem o tema claro. `--bg`, `--ink`, `--muted`, `--line`, `--surface`, `--primary`, `--accent` e `--red` em `atelier.css` definem os papéis reais. O seletor `:root[data-theme=dark]` usa fundo `dark-background`, texto `dark-text` e acento claro `#dbb8f3`. Cereja destaca atenção e ações perigosas; não depende apenas da cor para comunicar situação. Foco recebe contorno visível. Barras de entrada e saída têm legenda textual e destinos equivalentes no Financeiro. Scrollbars possuem tokens globais e preservam cores do sistema em forced-colors.

## Typography

DM Sans com fallback de sistema para corpo, controles e tabelas. A marca existente conserva sua composição. Título principal de 32px, títulos secundários de 17px, detalhes técnicos de 15px conforme a camada final. Valores preservam moeda e casas decimais; texto importante quebra linha. Contagens usam singular/plural quando aplicável.

## Layout

Menu lateral de 232px no desktop e navegação inferior com Mais no celular. A página usa altura natural e rolagem do documento; diálogos longos possuem corpo rolável. Tabelas adaptam células com rótulos no celular, mantendo valores e ações. A consulta mostra até 10 visitas por página; filtros não apagam registros. Não aplicar altura de tabela à página inteira ou aos formulários irmãos. Respeitar safe areas existentes.

## Elevation & Depth

Vidro discreto sobre fundo suave, bordas e sombra leve. Cards financeiros não usam efeitos que reduzam contraste. Diálogos usam a top layer nativa. Ações perigosas ficam separadas das ações de consulta.

## Shapes

Cards usam a família de 20px; controles e navegação usam 8–12px. Cápsulas indicam estados e filtros. Ícones mantêm a família de traços existente; não adicionar um segundo conjunto.

## Components

### Foundational visual states

Links têm sublinhado/realce no hover, foco visível e estado pressionado. A seleção de período usa `aria-pressed`; indisponibilidade usa `disabled`. A sincronização tem estados de carregamento, pendente, salvo, erro e conflito, com recuperação persistente. Consulta de entidade ausente tem diálogo próprio com saída segura.

### Buttons and actions

Primário preenchido para confirmação/próximo passo, secundário para retorno e ações auxiliares, texto para consulta. Navegação entre registros usa âncoras reais; operações usam botões. Indicadores navegáveis exibem Ver registros. Nunca confirmar pagamento por toque em um indicador ou valor.

### Navigation and data display

Breadcrumb marca a página atual. `navigation.js` define filtros e URLs; `navigateTo` guarda filtros, página e rolagem no histórico. Procedimentos começam em Dia/Hoje, com Mês inteiro e Todo o histórico. Ranking abre visitas com o serviço; conjunto abre sua combinação exata. O preço permanece vinculado à visita. `destinations-ui.js` mantém fichas de consulta relacionadas.

### Forms and overlays

`openForm`, `field`, `selectField`, `textfield` e `modal` em `app.js` são os proprietários compartilhados. Validação é do aplicativo, com `novalidate`, mensagem em português, associação e foco no campo inválido. Textareas não redimensionam manualmente e crescem até um limite com rolagem. Select e date/time/month são nativos por decisão explícita: popup, idioma e geometria pertencem ao navegador/OS; labels e armazenamento pertencem ao aplicativo. Não se promete popup com geometria ou tradução próprias.

O cadastro dentro da agenda usa um painel de superfície suave no próprio formulário. Ele compartilha a família de bordas e campos, expande sem uma segunda janela e preserva a rolagem do diálogo.

### WhatsApp

A caixa mantém superfícies claras/ameixa e os mesmos tokens no escuro suave. No desktop, contatos à esquerda e conversa à direita; no celular, lista e conversa alternam com Voltar. O compositor tem altura natural e área de histórico própria. As origens WhatsApp e Notas internas são explícitas. Configuração usa `openForm`/`modal`/`field`; estados de envio têm rótulo, sem depender da cor. Dados da cliente e conteúdo podem quebrar linha. Não exibir QR ilustrativo ou sugerir que configurar a chave já comprova recebimento real.

### Iconography

SVGs existentes do mapa `icon()`; ícones decorativos não substituem rótulos. Controles apenas com ícone têm nome acessível em português.

### Motion

Transições de controles de aproximadamente 160ms. `prefers-reduced-motion` desliga transições; transparência reduzida tem caminho sólido. Nenhuma animação é necessária para compreender um valor.

### Content and data visualization

Português brasileiro direto: Ver atendimento, Ver cobrança e pagamentos, Concluir atendimento. BRL e datas civis de Brasília. Recebido, valor cobrado e saldo são conceitos separados. Gráficos e indicadores abrem os registros que sustentam seu valor; não redistribuem preços de pacotes.

## Do's and Don'ts

- **Do:** preservar histórico ao mudar o período e mostrar claramente os filtros ativos.
- **Do:** reutilizar links, diálogos e validação canônicos entre as telas.
- **Don't:** sugerir que tocar em um valor registra pagamento.
- **Don't:** usar decoração ou truncamento para esconder informação operacional.

### Novas ações de exclusão e conexão por QR Code

Mantém os tokens e componentes existentes. Excluir registro no cabeçalho abre lista com rótulos de vínculo; Excluir definitivamente usa danger, Manter registro é a saída segura. QR temporário tem dimensão reservada de 280px e largura máxima de 100%, em superfície de configuração existente, sem imagens ilustrativas de pareamento. Campos técnicos aparecem só na configuração inicial do conector.


## Conta e exclusões — decisão da versão 13

A solicitação atual autoriza exclusão de todas as informações operacionais com confirmação. Usar a lista comum, busca textual, prévia de dependências e checkbox obrigatório. Nunca remover dados ao navegar. A API DELETE tem plano e revisão próprios; não afrouxar POST. Mostrar nomes, datas e valores, sem exigir interpretação de IDs. O fluxo de acesso tem formulário sem cadastro público, mensagens inline, mostrar/ocultar senha e recuperação pela titular. Reutiliza tokens e tema existentes. Primeiro acesso e recuperação usam a identidade Sites, preservando os dados da titular original. A configuração técnica do WhatsApp ocorre uma vez; os próximos pareamentos reutilizam o acesso salvo.
