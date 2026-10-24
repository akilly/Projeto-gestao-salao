# Verificação — WhatsApp YCloud (20/10/2026)

## Evidência

- `node --test tests/*.test.mjs`: 68 testes aprovados; 14 são específicos do canal, com SQLite em memória e HTTP simulado. Cobrem identidade, origem, base de demonstração, cifra por titular, propriedade do número, HMAC/replay, deduplicação atômica, janela após upload, status fora de ordem, resultado incerto/idempotência, mídia e isolamento, paginação e falha de armazenamento.
- `npm run lint`: exit 0, sete avisos preexistentes em app.js/layout.tsx; nenhum erro.
- `node_modules/.bin/tsc --noEmit --incremental false`: exit 0.
- `designmd lint DESIGN.md`: zero erros e cinco avisos de tokens espelhados do runtime canônico, já presentes no modelo de documentação.
- Build oficial do Sites: necessário na preparação do pacote desta versão; resultado registrado no fluxo de publicação.

## Navegador

Preview gerenciado em `terminal.local:4173`, usando harness temporário fora do pacote publicado. Nenhuma API externa ou mensagem real foi acionada. A tela de teste foi explicitamente identificada como fictícia.

Foram exercitados: consulta da caixa, seleção de contato, compositor, rascunho preservado após Atualizar e troca de contato, envio simulado e aceite visível, falha da rede após o aceite e Conferir tentativa sem uma segunda bolha, resolver com redução do contador, confirmação de desconexão com foco na ação segura, estado vazio, falha de consulta e sessão expirada com reentrada. Arquivo recebido indisponível mostra orientação para consultar no Business. Formulário de conexão apresentou erro associado/foco ao enviar sem chave e conclusão simulada com uma chave fictícia.

A variante móvel foi inspecionada em iframe de 390 px (380 px de área útil, sem overflow horizontal). Lista e conversa alternam com Voltar. O prazo encerrado desabilitou campo, anexos e envio. Temas claro e escuro suave inspecionados; contraste e controles seguem os tokens compartilhados. Isto não é certificação integral WCAG nem teste em aparelho físico.

Prévia da configuração: `WHATSAPP_PREVIA.jpg`. O número exibido é fictício e a chave está vazia.

## Auditoria estática

`audit_project.py --mode strict` gerou `AUDITORIA_WHATSAPP.json`, preservado sem edição. Retornou 21 ocorrências de affordance.actionless-button, todas em templates de app.js com data-action e delegação de eventos. São falsos positivos da heurística que não reconhece esses handlers; os destinos constam nos listeners do aplicativo e nos testes existentes. A nova caixa também usa delegação explícita, campos/diálogos/toast canônicos e botões semânticos. Nenhum handler inline artificial foi adicionado para contornar o auditor. Não se afirma aprovação limpa da auditoria estática.

## Limites e ativação

Não houve conta YCloud real, chave do provedor, QR autorizado, webhook real ou entrega real. O segredo de cifra foi configurado no runtime do Sites, sem valor no repositório. Após publicar, a titular conclui Atendimentos → WhatsApp → Conectar WhatsApp e valida texto, imagem e áudio com um telefone de teste autorizado. Histórico antigo, gravação por microfone e arquivo permanente de mídia não integram esta etapa. Ver `INTEGRACAO_WHATSAPP.md`.
