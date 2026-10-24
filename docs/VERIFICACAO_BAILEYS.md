# Verificação de 24/10/2026 — Baileys e exclusão

- `node --test tests/*.test.mjs services/baileys/*.test.mjs`: 93 passaram, 0 falhas. Inclui SQLite real, HTTP real do conector sem abrir socket WhatsApp, propriedade de conta, assinatura, replay, tentativa incerta sem duplicação, exclusões vinculadas recusadas e imutabilidade financeira.
- `node_modules/.bin/tsc --noEmit --incremental false`: passou.
- `npm run lint`: passou sem erros; 7 avisos anteriores de código legado/Next. O alias loadAuthState evita falso positivo de React Hook em uma API Node do Baileys.
- Baileys 7.0.0-rc14 instalado com lockfile; exportações utilizadas conferidas por importação real.
- Navegador na prévia do Sites, com harness de API simulada e dados locais: lista de exclusão, identificação do registro, confirmação, Manter registro sem remover, retorno de foco; abertura do formulário Baileys e validação vazia com foco no campo; layout de 360px, diálogo com corpo rolável e ações acessíveis; alternância claro/escuro. Nenhuma exclusão de dado real ou envio WhatsApp foi executado.
- Harnesses removidos de public antes da publicação. Download do conector contém somente fonte, instruções, lockfile, testes e .env.example; sem chave nem credenciais ou diretório data.
- Auditoria premium estrita executada: achados `affordance.actionless-button` em botões legados com data-action delegado, já reconhecidos no UX-CONTRACT. Inspeção dos handlers confirmou ações reais; não foram adicionados onClick duplicados para contornar heurística. Novos comandos compartilham os mesmos proprietários de formulário, diálogo, toast e persistência. Tokens preservados.

Limites: não houve QR real, pareamento, recebimento, entrega ou teste de codecs reais. Conector dedicado com domínio HTTPS e volume persistente ainda precisa ser instalado e permanecer ligado. Não foi feita certificação integral de acessibilidade, teste em aparelho físico ou de todas as telas históricas. Build e publicação são verificados no fluxo oficial Sites.
