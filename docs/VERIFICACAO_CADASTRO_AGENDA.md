# Verificação: cadastro durante o agendamento

Entrega de 20/10/2026, posterior à consulta diária de procedimentos.

- `node --test tests/*.test.mjs`: 54 testes passaram. Os seis novos casos cobrem cliente novo e existente, vínculo entre entidades, falha sem mutação parcial, conflito, equivalência de telefone com DDI, contato/data inválidos e bloqueio sem cliente.
- `npm run lint`: saída 0, com os mesmos sete avisos preexistentes; sem erros.
- `node_modules/.bin/tsc --noEmit --incremental false`: saída 0.
- `git diff --check` e análise de sintaxe dos módulos alterados.
- Build oficial Sites é uma etapa obrigatória da preparação do pacote; publicação só prossegue se essa etapa terminar com sucesso.

Navegador na prévia gerenciada, com API e contatos fictícios: cadastro durante a reserva, sugestão de cliente pelo telefone com +55, escolha manual do cadastro existente, ida e volta entre os modos sem perder nome, telefone, horário ou observações; confirmação cria cliente e agenda juntos. Retomar edição após Cancelar preserva os campos. A edição de detalhes do novo agendamento mostra as observações preservadas. Viewport de aproximadamente 325px sem overflow horizontal; diálogo longo rolável com ações alcançáveis. Falha simulada 503 exibiu recuperação e a nova tentativa confirmou cliente e reserva sem duplicar registros. O agendamento com cliente já cadastrada também foi confirmado.

Comparado com o cadastro completo de cliente e o formulário de bloqueio. As regras de contato e de horários são compartilhadas. Não há mudança na paleta, no modelo de acesso ou na API de persistência. O cadastro começa como Temporário, seguindo a escolha já existente no cadastro completo; confirmação de identidade permanece explícita.

O auditor genérico do plugin não reconhece `data-action` delegado e produz falsos positivos de botão sem ação. Os achados são revisados contra os handlers; não se altera o markup com onclick artificial para satisfazer a expressão regular. A revisão não é uma certificação integral de acessibilidade nem um teste em aparelho físico. A integração real do WhatsApp ainda depende de provedor/conta/autorização e não faz parte destes testes.
