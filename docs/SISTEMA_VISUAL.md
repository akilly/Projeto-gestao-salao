# Sistema visual do ateliê Hanne

A interface foi pensada para uma profissional que registra visitas principalmente pelo celular. As ações do dia têm prioridade sobre configurações e operações ocasionais. Os temas claro e escuro compartilham estrutura, significados e componentes.

## Identidade

| Elemento | Claro | Escuro suave | Uso |
| --- | --- | --- | --- |
| Fundo | #f7f5f8 | #2c2834 | Base discreta com reflexos suaves |
| Texto principal | #292333 | #f5f0f8 | Títulos e informações essenciais |
| Roxo | #74459a | #dbb8f3 | Navegação, referências e ações |
| Ação preenchida | #78469c | #8553ac | Confirmação e próximo passo |
| Cereja | #b64160 | #ffb1c2 | Pendências que precisam de atenção |
| Capa | #493052 | #584063 | Resumo do dia com texto claro |

O vidro aparece em superfícies discretas, bordas e painéis. Os campos, números e textos usam cores sólidas para manter leitura. A capa usa um tom ameixa estável e círculos decorativos em CSS; não depende de imagens remotas. Manrope e DM Sans são as fontes já presentes no projeto; Georgia em itálico dá um detalhe editorial à capa. Há fontes de sistema como alternativa.

## Organização das páginas

- **Visão geral:** capa com visitas de hoje, atalhos de conclusão/agendamento, pendências distintas, caixa e indicadores adicionais recolhidos.
- **Agenda:** resumo do dia, seleção semanal, linha de horários e acesso direto a Concluir.
- **Serviços:** histórico mensal como primeira aba, indicadores do período, resultados acumulados e catálogo em aba separada.
- **Clientes, estoque e financeiro:** cabeçalhos consistentes, ações contextualizadas, linhas de dados no computador e cartões identificados no celular.
- **Atendimentos, orçamentos e tarefas:** listas com estados explícitos, hierarquia entre nome, descrição e próximo passo.
- **Configurações e preparação:** grupos de campos com orientação e separação entre configuração inicial e rotina.

Cada página inclui “Como usar esta tela”. A explicação fica próxima ao trabalho e pode ser aberta sem navegar para um manual. Ela descreve a consequência real de cada ação, incluindo a diferença entre preço cobrado e dinheiro recebido.

## Componentes e adaptação

A navegação do computador se organiza em Dia a dia e Gestão. Em larguras intermediárias, usa ícones com nomes acessíveis; no celular, o menu é aberto por botão e há atalhos inferiores persistentes.

As tabelas mantêm todos os campos. `adaptTables` usa os cabeçalhos para preencher data-label. Abaixo de 760 px, cada linha vira um cartão com rótulos, nome em destaque e ação ao final. Não manter uma versão móvel independente com valores calculados de outra forma.

Os formulários usam campos amplos, foco visível e etapas curtas. Na conclusão, o botão final confirma o conjunto inteiro. Sugestões de produtos têm referência de data e exigem revisão; uma sugestão nunca deve parecer um consumo já confirmado. Temas podem ser trocados com formulário aberto sem perder o preenchimento.

## Acessibilidade e manutenção

Estados são descritos em texto, além de cor. Ícones de ação têm nomes acessíveis. A preferência de tema é local; não pertence ao snapshot financeiro. Animações são mínimas e respeitam redução de movimento. Superfícies têm alternativas opacas, e a impressão usa fundo claro.

Ordem dos estilos: public/style.css, public/theme.css e public/atelier.css. A última folha é a direção visual final. Ao revisar um componente, verificar ambos os temas, teclado e larguras de 320, 390, 768 e computador. Verificar overflow e leitura de campos longos. Não criar percentuais de crescimento ou indicadores financeiros apenas para preencher a interface.

As telas de revisão usam exclusivamente dados fictícios e uma API local simulada. Os arquivos temporários não são incluídos na publicação.
