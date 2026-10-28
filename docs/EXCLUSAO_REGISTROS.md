# Exclusão de informações

A versão 13 substitui o bloqueio absoluto de históricos por um plano explícito de exclusão, com confirmação da usuária e validação do servidor.

Todas as coleções operacionais oferecem exclusão nas telas de gestão. O plano lista cada registro afetado. Ficha/cobrança, parcela/pagamento e compra/estoque são tratados em conjunto. Entradas de estoque podem envolver movimentos posteriores e seus atendimentos. O servidor recalcula os custos e rejeita estado inválido.

A chamada DELETE /api/state exige revisão atual, confirmed=true, o plano exibido e a **senha da conta** (`password`), conferida no servidor com PBKDF2 e limite de 10 tentativas a cada 15 minutos por IP. Sem a senha correta nada é apagado, mesmo com uma sessão aberta. POST comum continua sem permitir remoção de histórico financeiro. Nenhuma exclusão ocorre por simples navegação ou clique no indicador.

Mensagens e conversas reais usam DELETE /api/whatsapp/erase-message/:id e erase-thread/:id, sempre com confirmação. Remove conteúdo do sistema, sem apagar do WhatsApp ou do disco do conector. Metadados técnicos continuam para evitar reenvios duplicados. Envio ainda sem confirmação deve ser conferido antes.

Configurações permite reiniciar os dados operacionais da base escolhida, incluindo ajustes e data de início. Não apaga credenciais, conversas reais ou auditoria técnica. Não existe restauração automática pela interface; exporte uma cópia antes de apagar se precisar preservar os dados.

## Edição e exclusão em cada registro (versão 17)

Cada registro tem **Excluir** na própria janela: cliente, serviço, agendamento, orçamento, tarefa, nota interna, produto, movimento de estoque, atendimento, cobrança, pagamento ou sinal, parcela e despesa. A lista “Excluir registro” no topo das telas continua disponível.

Correções permitidas em registros confirmados. O servidor confere tudo de novo em `validateState`:

- **Cobrança:** descrição, datas e valor. O valor não pode ficar abaixo do já pago. Se a cobrança vem de um atendimento, o preço é corrigido na ficha.
- **Atendimento:** preço total e serviços, com a cobrança acompanhando, além de fórmula, observações e manutenção. Cliente, data e consumo não mudam (exclua e registre de novo).
- **Pagamento ou sinal:** valor, data e forma (Pix ou transferência). Pagamentos no cartão não são editáveis, por causa das parcelas e repasses.
- **Despesa:** tudo. O valor de compra de produto é corrigido pelo movimento de estoque.
- **Produto:** nome, marca, embalagem e mínimo. A unidade não muda.
- **Movimento de estoque:** quantidade, valor, data e nota. O livro de custos é recalculado. Se a correção alterar saídas posteriores, ela é recusada com a orientação de excluir e lançar de novo. O consumo de atendimento só aceita a nota.
- **Agendamento não concluído:** cliente, serviço, data, horário, duração e observações, conferindo expediente e conflitos.
