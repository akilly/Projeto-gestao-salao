# Exclusão de informações

A versão 13 substitui o bloqueio absoluto de históricos por um plano explícito de exclusão, com confirmação da usuária e validação do servidor.

Todas as coleções operacionais oferecem exclusão nas telas de gestão. O plano lista cada registro afetado. Ficha/cobrança, parcela/pagamento e compra/estoque são tratados em conjunto. Entradas de estoque podem envolver movimentos posteriores e seus atendimentos. O servidor recalcula os custos e rejeita estado inválido.

A chamada DELETE /api/state exige revisão atual, confirmed=true e o plano exibido. POST comum continua sem permitir remoção de histórico financeiro. Nenhuma exclusão ocorre por simples navegação ou clique no indicador.

Mensagens e conversas reais usam DELETE /api/whatsapp/erase-message/:id e erase-thread/:id, sempre com confirmação. Remove conteúdo do sistema, sem apagar do WhatsApp ou do disco do conector. Metadados técnicos continuam para evitar reenvios duplicados. Envio ainda sem confirmação deve ser conferido antes.

Configurações permite reiniciar os dados operacionais da base escolhida, incluindo ajustes e data de início. Não apaga credenciais, conversas reais ou auditoria técnica. Não existe restauração automática pela interface; exporte uma cópia antes de apagar se precisar preservar os dados.
