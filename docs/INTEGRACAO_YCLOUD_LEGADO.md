# WhatsApp Business — YCloud

## Estado da entrega em 20/10/2026

API e interface implementadas. A titular ainda precisa criar a conta YCloud e vincular seu número. Não foram cadastradas credenciais do provedor, escaneado QR Code ou enviadas mensagens reais. Os testes usam SQLite real e HTTP simulado; o navegador usa conversas fictícias. Isso não comprova envio ou recebimento com uma conta real.

## Ativação

1. Entre com a conta do sistema que guardará as conversas e selecione Dados reais.
2. Abra Atendimentos → WhatsApp → Conectar WhatsApp.
3. Crie sua conta no YCloud, escolha o plano adequado e conecte o WhatsApp Business existente pelo fluxo oficial de coexistência. Leia o QR Code no provedor. Elegibilidade e aprovação dependem do número e da conta; não há QR ilustrativo dentro do sistema.
4. Em Developers → API Keys, gere uma chave com acesso às APIs de WhatsApp e webhooks. Cole no formulário seguro do sistema, junto com o número internacional (+55 e DDD). Não envie a chave por chat.
5. Confirme a autorização e toque em Verificar e conectar. O servidor confere se a chave autoriza o número e se ele está CONNECTED. Cria ou reutiliza o webhook da conta e cifra seus segredos automaticamente.
6. Envie uma mensagem de outro telefone sob seu controle. Confira o recebimento e a data do último evento. Responda para esse destinatário de teste autorizado e confira os estados de entrega. Repita com imagem e áudio antes de atender clientes.

O plano Free aparece na página de preços do YCloud; cobranças da Meta são separadas. Esta versão só responde conversas de clientes dentro da janela de 24h. Não contrata assinatura nem envia templates, campanhas ou lembretes pagos.

## Rotas do aplicativo

Todas exigem identidade do Sites, exceto o webhook. Toda mutação exige Origin exato e é bloqueada na demonstração. Nunca aceitar user_id do corpo da requisição.

| `/api/whatsapp/…` | Operação | Resultado |
|---|---|---|
| `connection` GET | Consultar | Estado sem chaves, número e último webhook |
| `connection` POST | Conectar | Verifica número, cifra chave e configura webhook |
| `connection` DELETE | Desconectar localmente | Remove segredos; preserva histórico |
| `threads` GET | Listar contatos | 100 por página, cursor before e total de pendentes |
| `thread/{id}` GET | Consultar mensagens | 50 por página, cursor before e prazo |
| `thread/{id}` POST | Resolver/reabrir | Organização interna, sem enviar mensagens |
| `send` POST multipart | Responder | requestId, threadId, text, file opcional |
| `media/{id}` GET | Visualizar arquivo recebido | Proxy autenticado e isolado por conta |
| `webhook/{canal}` POST | Receber eventos | HMAC obrigatório sobre bytes originais |

## Modelo e segurança

`wa_connections` tem um canal por conta e um titular por telefone. API key e segredo do webhook são cifrados com AES-GCM, usando a conta como AAD. O segredo de runtime WHATSAPP_ENCRYPTION_KEY (base64 de 32 bytes aleatórios) fica somente no Sites. Não rotacionar sem migrar as cifras existentes.

`wa_threads` guarda contato, telefone ou BSUID, último recebimento e situação. Não cadastra clientes nem une identidades por nome/telefone automaticamente. `wa_messages` guarda conteúdo, tentativa única, ID do provedor e status. `wa_events` registra IDs já processados. Índices cobrem canal, contato, tempo e identificadores únicos.

A migração aditiva 0001_amazing_giant_girl.sql foi gerada com Drizzle. Sites aplica a migração na publicação. Não há DDL durante requisições nem alteração de migrations aplicadas. Mensagens não alteram financeiro, estoque ou agenda.

O endereço público não concede acesso às conversas: cada consulta e arquivo verifica a identidade e o pertencimento ao canal. Chaves, URLs assinadas e payloads completos não são registrados em logs nem devolvidos ao navegador. O proxy só envia a chave a HTTPS api.ycloud.com/v2/whatsapp/media/download/{id}, sem seguir redirects, e limita tipo/tamanho da resposta.

Desconectar remove os segredos locais e bloqueia novos eventos e envios. Não remove número/webhook do YCloud nem encerra o Business no telefone. Para revogação completa, a titular revoga a chave e remove o webhook no provedor. Reconectar o mesmo número reutiliza o histórico e a URL. Troca para outro número está bloqueada para evitar misturar históricos.

## Eventos e entrega

Inscrições: whatsapp.inbound_message.received, whatsapp.message.updated e whatsapp.smb.message.echoes. Echo registra mensagens do aplicativo Business sem abrir a janela de resposta. Histórico antigo não é importado automaticamente.

YCloud-Signature usa HMAC-SHA256 sobre timestamp + ponto + bytes originais. A tolerância é de 5 minutos. O handler confere remetente empresarial/WABA, confirma evento e efeitos no mesmo batch D1 e responde erro em falha de armazenamento para permitir redelivery. Repetição não duplica mensagens nem reabre pendência resolvida. Formatos não suportados exibem orientação para consultar no Business; eventos desconhecidos não executam ações de negócio.

O servidor confere a janela de 24 horas, inclusive depois de subir arquivo. Mensagens de sistema não abrem janela. BSUID sem telefone permanece opaco e usa recipient; telefone usa to. Telefones e BSUIDs não são unidos automaticamente. Status read/delivered não regridem quando eventos chegam fora de ordem.

A tentativa reserva um requestId único antes de enviar. Repetir o mesmo ID não gera novo envio; corpo diferente com o mesmo ID é rejeitado. Aceite HTTP não é entrega. Falha após despacho pode ter resultado incerto: não há reenvio automático. Conferir tentativa reutiliza o mesmo ID. Já conferi no YCloud permite liberar o compositor somente após confirmação; não cancela uma mensagem já enviada. Não se assume garantia de exactly-once do provedor.

## Arquivos e limites

Um arquivo por mensagem. JPEG/PNG até 5 MB; MP3, M4A (audio/mp4), AAC, AMR ou OGG Opus mono até 16 MB. Cliente verifica tipo/tamanho; servidor também verifica assinatura binária. Validação completa de codec, imagem RGB de 8 bits e conteúdo final depende do provedor. Texto até 4096 caracteres; legenda de imagem até 1024; áudio sem legenda.

O servidor sobe o arquivo e envia o ID ao YCloud, sem bucket público. A mídia recebida é consultada por proxy; pode expirar no provedor. Não há arquivo permanente dos binários. Mensagem enviada mantém texto/legenda e status; a prévia do anexo fica durante a composição. Não há gravação de microfone, conversão de WebM, transcrição, importação de histórico antigo ou templates. Alguns formatos de áudio, como AMR, podem exigir consulta no telefone para reprodução.

## Fontes primárias consultadas

- [Preços](https://www.ycloud.com/pricing)
- [Coexistência e QR Code](https://docs.ycloud.com/en/documentation/channels/whatsapp-accounts-management/coexistence/onboard-whatsapp-business-app)
- [Envio](https://docs.ycloud.com/en/api-reference/guides/whatsapp-platform/send-whatsapp-message)
- [Assinatura e webhooks](https://docs.ycloud.com/reference/webhook-integration-guide)
- [Números](https://docs.ycloud.com/reference/whatsapp_phone_number-list)
- [Upload](https://docs.ycloud.com/v2.0.1/reference/whatsapp_media-upload)
- [Payloads de entrada](https://docs.ycloud.com/v2.0.1/reference/whatsapp-inbound-message-webhook-examples)
- [BSUIDs](https://docs.ycloud.com/en/api-reference/guides/whatsapp-platform/use-business-scoped-user-ids)
- [Formatos e limites](https://docs.ycloud.com/en/documentation/whatsapp-business-platform/messaging/service-messages)
- [Meta: preços](https://whatsappbusiness.com/products/platform-pricing/)

Alguns endereços legados redirecionam ao índice. Seus contratos foram lidos na indexação da documentação oficial; as guias atuais de envio, assinatura e BSUID foram abertas. A conta real precisa ser validada antes da operação.
