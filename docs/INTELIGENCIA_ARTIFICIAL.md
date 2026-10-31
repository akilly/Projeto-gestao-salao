# Inteligência artificial no Hanne

A IA ajuda a organizar o atendimento. Ela **só sugere**: nada é enviado à cliente e nenhuma categoria vale sem você conferir.

## O que ela faz

| Recurso | Onde | Como funciona |
|---|---|---|
| **Classificação automática** | Atendimentos → WhatsApp | Cada conversa com mensagem nova da cliente ganha uma etiqueta (Segurança, Agendamento urgente, Orçamento, Pós-procedimento…) e uma prioridade. Relatos de ardência, dor ou reação são sempre **Segurança · alta**. |
| **Classificação sugerida** | Notas internas → ícone de lápis → **Sugerir com IA** | Preenche a categoria; você confirma. |
| **Resumo** | Botão **Resumir com IA** (WhatsApp e notas) | Até 3 frases: o que a cliente quer, o que já foi combinado e o que falta responder. |
| **Sugestão de resposta** | Botão **Sugerir resposta** | No WhatsApp, o texto vai para o campo de resposta. Nas notas, vira o rascunho. Revise, edite e só então envie. |

A IA recebe o histórico da conversa (até 20 mensagens) e um pouco de contexto do sistema: nome da cliente, observações, próximo horário, último atendimento, saldo em aberto e horário de funcionamento. Assim a resposta já sai personalizada. Ela é orientada a não inventar preços, horários nem diagnósticos.

## Custo e limites

- Serviço: **Cloudflare Workers AI**, plano gratuito com **10.000 *neurons* por dia**, renovados às 21h de Brasília (00:00 UTC).
- Modelos:
  - classificação: Llama 3.1 8B, rápido e barato;
  - resumo e resposta: Llama 3.3 70B, melhor em português.
- **Limite do próprio sistema por dia, para cada salão**: 150 classificações, 30 resumos e 30 sugestões de resposta. Para um salão isso cabe na cota gratuita. A cota gratuita da Cloudflare é uma só para a conta inteira: com vários salões usando muito, ela pode acabar antes e a IA para até as 21h (Brasília).
- Se a cota acabar, a IA para até o dia seguinte e o resto do sistema continua normal. **Configurações → Inteligência artificial** mostra o uso de hoje.

## Como ligar

- **Na nuvem (Cloudflare):** o `npm run deploy:cloudflare` já liga a IA (binding `AI`).
- **No computador:** dê duplo clique em **`CONFIGURAR-IA.cmd`**.
  - Ele abre o login da Cloudflare (conta gratuita), porque os modelos rodam na nuvem deles.
  - Depois, feche e abra o `INICIAR-HANNE.cmd`.
  - Para desligar: `npm run ia:configurar -- --desligar`.

## Privacidade e segurança

- O texto das conversas vai para a Cloudflare só no momento da análise. Levantamentos públicos sobre o serviço indicam que o Workers AI **não treina modelos com os dados enviados**. Confira a política atual da Cloudflare antes de usar com dados sensíveis.
- Só a titular, com a sessão aberta, consegue usar a IA. As rotas exigem a mesma origem, e o tamanho das conversas enviadas tem limite.
- As mensagens das clientes são tratadas como **dados**: a IA é instruída a ignorar pedidos escritos nelas, como "ignore as instruções".
- A resposta da IA nunca é enviada automaticamente e a categoria nunca é aplicada sem confirmação nas notas. A etiqueta do WhatsApp é só informativa.

## Ainda não incluído

**Transcrição de áudio** (o modelo Whisper está disponível no Workers AI): fica para uma próxima etapa, se você quiser.
