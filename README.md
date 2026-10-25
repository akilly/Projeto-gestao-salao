# Hanne · Gestão do ateliê

Aplicação em português para uma profissional. Interface orientada ao celular, API Vinext/Cloudflare e banco D1 provisionado pelo Sites. A audiência original do Site é preservada. Nenhum serviço externo pago é usado por esta atualização.

## Operação

A conta autenticada começa com clientes, histórico, estoque e financeiro vazios. O catálogo inicial contém sugestões editáveis de serviços. A preparação define a data de corte, o valor fixo do espaço e os saldos anteriores. Dados da antiga demonstração no navegador não são enviados ao banco automaticamente.

### Acesso e usuário de teste

No primeiro acesso publicado, escolha **Cadastrar usuário titular**, confirme a identidade da titular pela hospedagem e informe e-mail e senha com pelo menos 12 caracteres. O sistema possui uma única conta titular; não há cadastro público.

Para desenvolvimento local, execute `npm run user:test:create` depois do build. A conta criada somente no D1 local é `teste@hanne.local`, com senha `HanneTeste#2026`. O comando pode receber `TEST_USER_EMAIL` e `TEST_USER_PASSWORD` para usar outras credenciais locais. Nunca use essa conta ou essa senha na publicação.

O fechamento em três etapas registra vários serviços por visita, preço total combinado, consumo em g/ml/unidades, ficha técnica, aplicação de sinais e pagamento parcial. O fechamento inteiro é salvo de forma atômica. Estoque insuficiente impede a operação.

O financeiro separa dívida de clientes, cartões aceitos e repasses efetivamente recebidos. Parcelas preservam os centavos e os vencimentos mensais. Taxas desconhecidas permanecem pendentes; o repasse exige líquido e data conferidos. Sinais anteriores não geram nova receita; a retenção é manual e mantém o dinheiro na data em que entrou.

Compras geram estoque e despesa vinculada. O caixa considera a compra paga, enquanto o custo de consumo aparece separadamente. Estoque usa custo médio quando conhecido, registros de perda e conferência de custo. Cada consumo preserva o custo conhecido na ocasião; dados antigos incompletos não são preenchidos com estimativas silenciosas.

O painel filtra por mês ou período completo, mostra movimento de caixa, valores dos atendimentos e ranking dos serviços por frequência. Não distribui artificialmente a receita de conjuntos entre serviços e não chama resultado de caixa de lucro.

## Persistência e acesso

A API rejeita ausência de identidade, verifica a origem das escritas e valida os dados no servidor. O identificador injetado pela hospedagem é a chave da conta. O agregado é persistido em D1 com revisão otimista e evento de auditoria na mesma transação. Uma edição concorrente produz conflito explícito, preservando o rascunho na memória para exportação ou conferência. Não há sincronização por localStorage.

As tabelas e metadados de migração estão em db/ e drizzle/. Não alterar migrações já aplicadas. Limite inicial: 3 MB por atualização e 10 mil itens por coleção; o servidor recusa excessos. Fotos de orçamento ficam limitadas a três imagens de até 500 KB. Para crescimento além desse uso individual, normalizar as entidades e mover anexos para armazenamento de objetos.

## Validação

`node --test tests/*.test.mjs services/baileys/*.test.mjs` testa regras de agenda, CSV, fechamento, estoque, sinais, cartão, fluxo de caixa, autenticação, isolamento de contas, conector e conflitos de gravação. A persistência é exercitada com SQLite real em memória, usando o SQL da migração. O build é realizado pelo helper oficial Sites. A revisão visual usa navegador local com dados fictícios isolados. A suíte atual tem 106 testes.

## Pendências conhecidas

IA de classificação/resumo/transcrição, notificações externas, exportação XLSX nativa, biometria, restauração e backups automáticos não estão implementados. Exportação CSV, impressão para PDF e cópia JSON são manuais. Histórico de movimentos e valores confirmados não pode ser apagado ou sobrescrito; estornos e correções financeiras por lançamentos de reversão ficam para uma etapa posterior. A retenção de sinal registra uma decisão manual da profissional. Quando há compromisso ativo vinculado, a tela exibe o agendamento e exige uma confirmação explícita para cancelar e reter o sinal na mesma gravação. O valor recebido é preservado sem nova entrada de caixa. A aplicação não estabelece a política contratual.

## Demonstração com dados fictícios

O endereço `/?dados=exemplo` abre oito clientes, doze atendimentos, oito produtos, parcelas, despesas, sinais e agenda fictícios. A base de exemplos é isolada por usuário no banco (sufixo `::examples-v1`). O endereço `/?dados=reais` acessa a base real original, preservada. A escolha de visualização é uma preferência local; nenhum registro de negócio é salvo no localStorage. Indicadores, páginas e exportações identificam a demonstração. A API rejeita a gravação de um snapshot marcado como fictício na base real.

## Documentação do projeto

- [Documentação técnica](docs/DOCUMENTACAO_TECNICA.md): arquitetura, modelo, API, cálculos, persistência, segurança e manutenção.
- [Manual de usuário](docs/MANUAL_USUARIO.md): preparação, rotina de atendimento, estoque, financeiro e recuperação de falhas.
- [Referência das funções](docs/REFERENCIA_FUNCOES.md): catálogo das funções da aplicação com seu propósito.
- [Mapa dos arquivos](docs/MAPA_ARQUIVOS.md): inventário do código e separação entre aplicação, infraestrutura e arquivos gerados.

Os comentários explicam a implementação e os documentos acompanham as regras atuais. Para manter a referência correta, atualize também os documentos quando mudar uma tela, um cálculo, um limite ou um contrato da API.


## Aparência e navegação

A interface oferece temas claro e escuro suave com superfícies de vidro, roxo como destaque e vermelho para atenção. O seletor fica no topo e em Configurações. A escolha `hanne-theme` é local e não modifica os registros. O menu agrupa Dia a dia e Gestão; no celular há atalhos inferiores. O painel mantém as pendências visíveis e agrupa indicadores adicionais em uma seção expansível.


## Histórico mensal e rotina simplificada

Serviços abre os atendimentos do mês e permite consultar meses antigos ou o histórico completo. A troca de mês não apaga dados. Os resultados acumulados contam cada procedimento e somam preços por conjunto vendido, sem rateio artificial.

Concluir pela agenda preenche cliente, data e serviço e mantém a duração reservada. A última ficha da mesma cliente e conjunto pode preencher quantidades de produtos para conferência, sem baixar estoque antes da confirmação. O saldo restante pode ser preenchido descontando os sinais selecionados.

Após configurar início, valor e vencimento, a conta do espaço é criada uma vez no mês atual em aberto ao acessar ou retomar o aplicativo. Não executa com o site fechado nem preenche meses pulados. Contas existentes e pagamentos confirmados são preservados. Cada tela explica seu uso em “Como usar esta tela”.

A direção visual final está em public/atelier.css; o documento docs/SISTEMA_VISUAL.md explica componentes, temas e leitura no celular.


## WhatsApp Business

Canal direto Meta Cloud API para textos, imagens e áudios. Comece com o número de teste da Meta em Atendimentos → WhatsApp → Conectar à Meta. A conexão exibe credenciais verificadas, callback e mensagem real separadamente. Não migra o número do Business. Ver [guia da integração](docs/INTEGRACAO_WHATSAPP.md). Segredos são cifrados por conta; a chave mestra de runtime fica no Sites. Os testes são simulados e não atestam entrega real antes da ativação.


## WhatsApp por QR e exclusão — 24/10/2026

Conector Node Baileys em `services/baileys`, com instalação e ativação pendentes. Consulte `docs/INTEGRACAO_BAILEYS.md`. A interface oferece download do conector sanitizado. Exclusões sem vínculos usam `public/deletion.js`; financeiro e estoque confirmados são preservados. Testes completos: `node --test tests/*.test.mjs services/baileys/*.test.mjs`.


## Versão 13 — conta da Hanne e exclusões confirmadas

- Login próprio em `/login`, configuração e recuperação pela titular do Site.
- Exclusão de cadastros, fichas, cobranças, pagamentos, parcelas, despesas e estoque, com prévia completa dos vínculos.
- Exclusão local de conversas e mensagens de WhatsApp, preservando IDs de deduplicação.
- Reconexão Baileys com acesso já salvo e QR real. O conector precisa permanecer ativo em um servidor Node separado.

### Implantação

O projeto é um Worker Vinext com banco D1. Não é um site estático: GitHub Pages não executa as APIs, autenticação ou o banco. A publicação suportada utiliza o pipeline Sites e `.openai/hosting.json`, já vinculado ao projeto. O build copia `drizzle` para aplicar migrações na hospedagem. Não copie dados de produção, `.env`, sessões ou chaves para o GitHub. Para hospedagem fora do Sites, adapte também a identidade de bootstrap/recuperação da titular, os bindings e o processo de migração antes de expor o sistema.

Configure WHATSAPP_ENCRYPTION_KEY como segredo do Worker. Opcionalmente prepare BAILEYS_BRIDGE_URL e BAILEYS_BRIDGE_KEY para que a Hanne só clique em Gerar QR Code. Endereço/chave também podem ser cadastrados uma vez na interface. Leia `services/baileys/README.md` para o serviço separado. Nenhum pareamento real é feito automaticamente durante build ou deploy.

Valide com `node --test tests/*.test.mjs`, `node node_modules/typescript/bin/tsc --noEmit` e o helper de build Sites. Instale as dependências pelo helper do ambiente ou pelo gerenciador pnpm definido no package.json. O conector possui testes separados.
