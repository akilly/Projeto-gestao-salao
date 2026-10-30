> **Instalação no Windows (recomendada):** siga o `LEIA-ME.md` deste pacote (ou `docs/WHATSAPP_NO_COMPUTADOR.md` no repositório). O script `windows\instalar.ps1` faz todos os passos abaixo automaticamente.

# WhatsApp com Baileys

## Estado e limites

O site possui adaptador para Baileys, configuração HTTPS do conector e leitura do QR Code real gerado pelo processo Node. Não existe instância de conector hospedada nesta entrega e nenhum número foi pareado. Envio/recebimento real depende dessa instalação e do teste com o telefone da titular. A hospedagem Cloudflare Workers do site não executa o processo Baileys continuamente.

Baileys é uma biblioteca independente da Meta. Não oferece garantia de estabilidade, elegibilidade ou proteção contra restrições/bloqueio do número. A biblioteca é gratuita; computador, rede, domínio, túnel HTTPS ou hospedagem podem ter custos. Não prometer funcionamento permanente a custo zero.

## Instalar o conector

A pasta `services/baileys` integra o repositório do projeto, mas é um serviço separado do Worker. Requisitos: Node 22.13 ou superior, disco persistente privado, um único processo por pasta de dados, acesso de saída ao WhatsApp e ao site. Usar domínio HTTPS público e proxy reverso para `127.0.0.1:3100`. O proxy deve aceitar uploads de 17 MB e timeout de pelo menos 60 segundos. Nunca expor o diretório de dados.

1. Entre em `services/baileys` e execute `npm ci`.
2. Copie `.env.example` para `.env`.
3. Gere uma chave aleatória: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
4. Coloque a chave em `BRIDGE_KEY`. Mantenha `SITE_ORIGIN` com a origem exata do site publicado. Configure `DATA_DIR` em volume persistente privado e `PORT` se necessário.
5. Execute `npm start`. Configure reinício pelo gerenciador de serviços do seu computador/servidor. Não use múltiplas réplicas nem disco efêmero.
6. No site, abra Dados reais → Atendimentos → WhatsApp → Conectar por QR Code. Informe o domínio HTTPS e a mesma chave. Nunca compartilhe a chave por chat.
7. Leia o código usando WhatsApp Business → Aparelhos conectados → Conectar aparelho. Aguarde o estado conectado. A tela consulta o conector a cada 12 segundos; o QR expira e é substituído pelo conector.
8. Envie uma mensagem de outro telefone. Confira recebimento, pendência, resposta, imagem, áudio e status. Teste também reiniciar o conector sem ler novamente o QR.

## Segurança e contrato

Um conector atende uma única conta/número. Associação com outra conta é recusada. Um número diferente do histórico existente também é recusado; não unir dados implicitamente. As chamadas site → conector usam Bearer sobre HTTPS; o domínio cadastrado não aceita IP literal, HTTP, porta, credenciais ou caminho. Redirecionamentos são recusados. O operador deve usar domínio próprio sob seu controle, sem DNS apontado para rede interna.

A chave do conector fica cifrada em AES-GCM na D1, com chave mestra existente e AAD da conta. Cookies de sessão não são enviados ao conector. A pasta `data/auth` guarda as credenciais de aparelho conectado em arquivos privados; é material sensível, não deve ser publicado nem incluído em backups abertos. Os arquivos usam umask 077; cifragem do disco e backup privado são responsabilidade da instalação. Não usar esta implementação de armazenamento de sessão para um serviço público multicliente.

Eventos conector → site usam HMAC-SHA256 sobre timestamp + corpo, tolerância de cinco minutos, deduplicação na D1 e validação do número de origem. Webhooks não usam autenticação de visitante. Site → conector é autenticado e a configuração de callback só aceita a origem definida em SITE_ORIGIN. Não registrar texto, chaves, QR ou credenciais em logs.

## Recebimento, envio e mídia

Recebe mensagens novas individuais (incluindo eco de mensagens enviadas pelo celular), textos, imagens e áudios. Grupos, status e importação do histórico antigo não fazem parte desta entrega. LIDs são resolvidos para telefone quando o Baileys fornece o vínculo; mensagens ainda sem resolução não são associadas a clientes por adivinhação.

Receber mensagem nova reabre uma pendência; replay não reabre. Resolver é organização interna. Clientes, agenda e financeiro continuam separados. A restrição de 24h fica somente nos adaptadores das APIs oficiais; Baileys verifica sessão conectada e envio explícito. Não há disparos automáticos nem em massa.

Texto até 4.096 caracteres; imagem JPEG/PNG até 5 MB, legenda até 1.024; áudio até 16 MB sem legenda. Formatos seguem a validação já existente no site; codecs não são convertidos e áudio não é gravado no navegador. O envio pode ser recusado pelo WhatsApp conforme formato/codec.

Anexos recebidos ficam no volume privado do conector por até 30 dias, disponíveis apenas por proxy autenticado no site. Após expirar ou faltar arquivo, a conversa preserva o texto e orienta consulta no celular. Não é um arquivo permanente de mídia.

O journal SQLite registra cada tentativa antes de chamar sendMessage. Repetir requestId com outro conteúdo é recusado. Resultado incerto não dispara outro envio; requer conferência manual. O journal de eventos mantém recebimentos/status para repetição assinada até confirmação do site. Conector fora do ar impede envio; é necessário recuperá-lo.

Desconectar tenta encerrar a sessão Baileys e apagar as credenciais de aparelho no conector, preservando mensagens no site. Se o conector estiver inacessível, a operação informa erro; remova o aparelho no próprio WhatsApp Business para revogar o acesso imediatamente.

## Validação pendente

Testes locais usam transporte simulado, SQLite real e biblioteca instalada. Pareamento com número real, retorno pelo domínio HTTPS definitivo, entrega e codecs reais continuam pendentes. Não anunciar integração ativa antes desses testes.

Fontes: https://github.com/WhiskeySockets/Baileys e Example/example.ts do mesmo repositório. Dependência fixada em baileys 7.0.0-rc14; futuras atualizações exigem revisão das mudanças e novo teste real.
