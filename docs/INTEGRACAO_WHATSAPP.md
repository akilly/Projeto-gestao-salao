# WhatsApp — visão geral dos caminhos

| Caminho | Na tela | Custo | Documento |
|---|---|---|---|
| Link wa.me com mensagem pronta | Sim (sempre) | Grátis | `public/wa-link.js` |
| Conector Baileys no computador do ateliê (QR Code) | Sim | Grátis | [INTEGRACAO_BAILEYS.md](INTEGRACAO_BAILEYS.md) e [WHATSAPP_NO_COMPUTADOR.md](WHATSAPP_NO_COMPUTADOR.md) |
| API oficial da Meta (Cloud API) | Não (só no servidor) | Pode ter cobrança da Meta | Este documento |

Todos os provedores convertem as mensagens para o mesmo formato interno de eventos (`EVENTS` em `lib/whatsapp-domain.mjs`) e usam o mesmo processamento atômico e deduplicado (`processChannelEvent`). Conversas e mensagens ficam em tabelas próprias (`wa_*`), separadas do estado financeiro.

O antigo adaptador YCloud foi removido em 30/10/2026 (não tinha mais botão na tela). Conexões YCloud antigas aparecem como desconectadas; as mensagens já gravadas continuam no histórico.

## Referência: API oficial da Meta


### Situação

O adaptador usa a Meta Cloud API (Graph API v25.0). A tela atual não oferece este caminho; ele continua no servidor e testado para uso futuro. Esta entrega foi testada com HTTP simulado e SQLite real; não houve acesso a credenciais da titular, criação de conta Meta, registro/migração de número ou envio real. A validação completa depende de uma conta e um número autorizados.

### Começar pelo teste

1. (Exige reativar o formulário da Meta em `public/whatsapp.js`.) Selecione Dados reais e abra Atendimentos → WhatsApp → Conectar à Meta.
2. Na Meta for Developers, crie/configure seu app com WhatsApp. Em WhatsApp → Configuração da API / API Setup, encontre o número de teste, o Phone number ID, o WABA ID e o token de acesso. Confirme seu próprio telefone como destinatário de teste conforme o painel.
3. Em Configurações do app → Básico, obtenha o App secret do mesmo aplicativo. Token e segredo ficam mascarados no formulário e são cifrados no servidor; não os envie pelo chat.
4. Informe os quatro valores no sistema. Os IDs não são o telefone com DDD. Verificar e preparar conexão confere se o token acessa o número dentro da WABA e tenta configurar o callback exclusivo pela Subscribed Apps API com override_callback_uri e verify_token.
5. Confira as três etapas na tela. Acesso ao número indica somente token/IDs conferidos. Endereço de recebimento exige o GET de verificação vindo da Meta. Mensagem real exige um evento assinado e correspondente ao número configurado. Token válido ou resposta de inscrição, sozinhos, não tornam a caixa pronta para responder.
6. Se necessário, abra Não chegou mensagem? Confira estas etapas. Em WhatsApp → Configuração / Webhooks no app Meta, copie a URL e o Verify token gerados pelo sistema, verifique/salve e assine o campo messages. Inscrever novamente repete a inscrição na WABA sem exigir colar os segredos outra vez.
7. Envie uma mensagem do telefone autorizado para o número de teste da Meta. Atualize a caixa, abra a conversa e responda. Confira o aceite e depois a confirmação de entrega. Repita com imagem/áudio antes da operação com clientes.

O formulário não chama register, não exclui cadastro do Business e não configura número por OTP. Preserva-se o número atual enquanto o teste usa o número fornecido pela Meta. Manter o número atual no aplicativo Business e na API exige coexistência oficial elegível: a documentação desse onboarding exige Solution Partner ou Tech Provider. A conexão direta não oferece um QR universal que dispense essas condições. Não orientar a titular a apagar o WhatsApp para conseguir testar.

### Gratuidade e limites

Não há assinatura de intermediário para o acesso direto à plataforma. Porém, não é correto prometer mensagens gratuitas ilimitadas. Na consulta de 20/10/2026, a FAQ oficial da Meta informa cobrança de mensagens de serviço a partir de 01/10/2026, com as primeiras 1.000 por número/mês gratuitas. A página oficial de preços ainda descreve respostas de serviço dentro da janela como gratuitas. Essa divergência está registrada; o painel/condições da conta precisam ser conferidos antes de produção. Nenhuma compra, assinatura, método de pagamento ou disparo pago foi autorizado/configurado nesta entrega.

O sistema só responde depois de receber mensagem e dentro de 24 horas; não envia templates, marketing, campanhas ou lembretes automáticos. Essa restrição técnica não comprova saldo gratuito da conta e não mede envios realizados em outros sistemas.

### Contrato técnico

- `lib/meta-cloud.mjs`: HTTP com Authorization Bearer ao host Graph oficial, timeout, códigos de erro traduzidos, assinatura HMAC-SHA256 e normalização de envelopes Meta. Tokens nunca são colocados em URLs.
- `lib/whatsapp-handler.mjs`: autorização por identidade Sites, configuração, consultas, envio com tentativa única e processamento atômico dos eventos normalizados. O snapshot financeiro é independente.
- `wa_connections`: campos aditivos provider, verify_token, webhook_verified_at, subscribed_at, meta_last_inbound e connection_error. Cifras AES-GCM reutilizam a chave mestra já existente no runtime; AAD é a conta autenticada. A migração 0002 é aditiva e preserva tabelas e migrations anteriores.
- POST connection recebe provider=meta, phoneId, wabaId, accessToken e appSecret. Consulta os números da WABA e aceita apenas o ID correspondente. Um número não pode pertencer a duas contas do sistema. Mudança para outro número é recusada quando já existe histórico; a troca de provedor para o mesmo número preserva os textos e vínculos.
- POST connection/retry refaz a inscrição usando as cifras do servidor. GET connection retorna etapas, IDs e callback. Retorna Verify token somente ao titular autenticado: este token serve ao handshake e não autoriza leitura/envio de mensagens. Nunca retorna accessToken ou App secret.
- GET/POST meta-webhook/{canal} são públicos na audiência atual do site. GET confere hub.mode, hub.verify_token e devolve hub.challenge em texto simples. POST valida X-Hub-Signature-256 com o segredo do app sobre bytes originais antes do JSON. A Meta não fornece timestamp nesse header; a proteção contra repetição é a deduplicação durável.
- Só são processadas entradas com WABA e phone_number_id correspondentes ao canal. Outras contas/números do mesmo app são ignorados. IDs de evento são hashes de identificação/direção/status/timestamp; IDs wamid não são truncados. Evento e seus efeitos são confirmados no mesmo batch D1. Uma falha permite redelivery; replays não duplicam mensagem nem reabrem conversa resolvida.
- Envio usa /{phoneId}/messages com messaging_product=whatsapp e biz_opaque_callback_data=requestId. Este último correlaciona status; não é assumido como garantia de idempotência da Meta. A tentativa é reservada antes de despachar. Duplo clique/repetição local reutiliza o mesmo registro. Resultado incerto não é reenviado automaticamente. HTTP aceito não significa entrega. Read/delivered não regridem com notificações fora de ordem.
- Os códigos de erro de token, destinatário de teste, janela e arquivo têm orientação no sistema. Tokens temporários expiram; para operação diária a titular precisa configurar o token adequado e seus ativos/permissões na Meta.

### Mídia e compatibilidade

Imagens/áudios mantêm limites e validação anteriores. Upload usa /{phoneId}/media e depois envia pelo ID retornado. Mídia recebida guarda apenas referência meta:{id}. O proxy autenticado verifica pertencimento, obtém nova URL pelo Media ID e só baixa HTTPS lookaside.fbsbx.com/whatsapp_business/attachments/, sem redirects, com limite de MIME/tamanho. Nenhum token é enviado a hosts de outro provedor. Arquivos de conexões antigas podem ficar indisponíveis ao trocar credenciais; textos e status permanecem.

Não há gravação/transcrição de microfone, importação automática de histórico antigo, arquivo permanente dos binários, associação automática a clientes ou migração do número. A normalização reconhece telefone e identificadores US.* quando presentes; não une automaticamente BSUID e telefone nem acompanha mudanças de identidade por nome. Payloads não reconhecidos têm consulta pelo WhatsApp como caminho complementar. O onboarding direto desta etapa não ativa coexistência nem seus ecos/histórico.

Chaves de um provedor nunca são usadas para baixar mídia de outro.

### Fontes primárias (20/10/2026)

- [Início e número de teste](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)
- [Subscribed Apps API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/subscribed-apps-api)
- [Callback por WABA](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/override/)
- [Endpoint e assinatura](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/)
- [Status e callback de correlação](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status)
- [Coexistência e requisitos](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [BSUIDs](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids/)
- [FAQ: condições de cobrança](https://whatsappbusiness.com/resources/faq/)
- [Preços: informação divergente sobre serviço](https://whatsappbusiness.com/products/platform-pricing/)

As duas páginas comerciais foram abertas. Várias páginas técnicas Meta bloquearam a abertura com 429 ou retornaram apenas o índice; seus contratos foram consultados pela indexação oficial. Não houve teste com uma conta real; essa limitação não é substituída pelos testes simulados.
