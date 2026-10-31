"""Gera o manual (HTML 1920x1080 por página) a partir dos prints e das posições salvas em boxes.json."""
import json, html

B = json.load(open('/tmp/manual/boxes.json'))
IMG = 'jpg/'
e = html.escape

def marks_for(name, use=None):
    m = B.get(name, {}).get('marks', [])
    return [x for x in m if use is None or x['n'] in use]

def shot(name, use=None, renumber=None, cls='shot'):
    out = [f'<div class="{cls}"><img src="{IMG}{name}.jpg">']
    for mk in marks_for(name, use):
        n = renumber.get(mk['n'], mk['n']) if renumber else mk['n']
        t = max(0.5, mk['t']); h = min(mk['h'] - (t - mk['t']), 99.5 - t)
        out.append(f'<span class="ring" style="left:{mk["l"]:.2f}%;top:{t:.2f}%;width:{mk["w"]:.2f}%;height:{h:.2f}%"></span>')
        cx = max(1.5, min(98.5, mk['l'])); cy = max(2.5, min(97, t))
        out.append(f'<span class="pin" style="left:{cx:.2f}%;top:{cy:.2f}%">{n}</span>')
    out.append('</div>')
    return ''.join(out)

def steps(items):
    return '<ol class="steps">' + ''.join(f'<li><b>{i+1}</b><div>{t}</div></li>' for i, t in enumerate(items)) + '</ol>'

def tip(t, kind='Dica'):
    return f'<div class="tip"><span>{kind}</span>{t}</div>'

pages = []
def page(section, title, lead, body_left, right, n=None):
    pages.append(f'''<section class="page"><div class="left"><div class="chip">{section}</div><h2>{title}</h2><p class="lead">{lead}</p>{body_left}</div><div class="right">{right}</div><footer><span>Manual Hanne · Gestão do ateliê</span><span class="num"></span></footer></section>''')

# 1 Capa
pages.append(f'''<section class="page cover"><div class="cover-text"><div class="logo"><i>h</i>hanne<b>.</b></div><h1>Manual de uso</h1><p class="sub">Seu ateliê, <em>em dia.</em><br>Agenda, clientes, financeiro, estoque e WhatsApp num só lugar.</p><p class="meta">Guia passo a passo com as telas do sistema · versão de outubro de 2026</p></div><div class="cover-art">{shot('01-visao-geral', use=[])}<div class="phone cover-phone"><img src="{IMG}17-cel-inicio.jpg"></div></div></section>''')

# 2 Sumário
toc = [('Primeiros passos', 'Entrar · Conhecer a tela · Painel do dia'), ('Agenda', 'Ver o dia · Agendar · Detalhes · Mensagem pronta'),
       ('Atendimento', 'Concluir atendimento · Clientes · Ficha da cliente'), ('Dinheiro', 'Financeiro · Gráficos · Receber de cliente'),
       ('Ateliê', 'Estoque · Serviços e histórico · Notas internas'), ('WhatsApp no sistema', 'Instalar o conector · Ler o QR · Responder'),
       ('Cuidados', 'Editar e excluir com senha · Cópias de segurança'), ('Do seu jeito', 'Tema escuro · No celular · Rotina · Dúvidas')]
pages.append('<section class="page toc"><div class="chip">Sumário</div><h2>O que você vai encontrar</h2><div class="toc-grid">' + ''.join(f'<div class="toc-item"><b>{i+1:02d}</b><div><h3>{a}</h3><p>{b}</p></div></div>' for i, (a, b) in enumerate(toc)) + '</div><footer><span>Manual Hanne · Gestão do ateliê</span><span class="num"></span></footer></section>')

page('Primeiros passos', 'Entrar no sistema', 'Abra o endereço do ateliê no navegador do computador ou do celular.',
     steps(['Digite o <b>e-mail</b> da conta.', 'Digite a <b>senha</b>. Toque em <i>Mostrar</i> para conferir.', 'Toque em <b>Entrar</b>. A sessão dura até 12 horas.'])
     + tip('No <b>primeiro acesso</b>, informe seu e-mail: chega um <b>link para criar a senha</b> (mínimo 12 caracteres). Esqueceu a senha? Toque em <i>Esqueci minha senha</i> e abra o link que chega no e-mail (vale 30 minutos).'),
     shot('00-login'))

page('Primeiros passos', 'Conhecendo a tela', 'Tudo fica no mesmo lugar em todas as páginas.',
     steps(['<b>Menu</b>: “Dia a dia” para a rotina e “Gestão” para o negócio.', '<b>Buscar</b>: encontre clientes e registros (atalho Ctrl+K).', '<b>Tema</b>: claro ou escuro, como preferir.',
            '<b>Demonstração</b>: dados de exemplo para treinar. Toque em <i>Usar dados reais</i> para trabalhar.', '<b>Concluir atendimento</b>: fecha a visita, produtos e pagamento.', '<b>Agendar</b>: marca um novo horário.'])
     + tip('Em toda página existe <b>“Como usar esta tela”</b>: toque para ver a explicação.'),
     shot('01-visao-geral'))

page('Primeiros passos', 'Seu painel do dia', 'A Visão geral mostra o que precisa da sua atenção hoje.',
     steps(['<b>Atendimentos pendentes</b>: conversas que ainda esperam resposta.', '<b>Agendamentos a confirmar</b>: hoje e próximos dias.', '<b>Período</b>: escolha o mês ou <i>Todo o período</i>.', '<b>Resumo financeiro</b>: toque em <i>Ver registros</i> para abrir os detalhes.'])
     + tip('O sino no topo junta contas vencidas, cobranças atrasadas e repasses do cartão.', 'Saiba'),
     shot('01b-painel'))

page('Agenda', 'Ver a agenda', 'Consulte os horários do dia ou dos próximos dias.',
     steps(['<b>Dias da semana</b>: toque para trocar de dia.', '<b>Hoje</b> volta para o dia atual.', 'Veja um <b>Dia</b> ou <b>5 dias</b> de uma vez.', 'Toque no <b>nome da cliente</b> para ver os detalhes.', '<b>Concluir</b> registra o atendimento feito.'])
     + tip('Intervalos e bloqueios aparecem tracejados. Use <i>Bloquear horário</i> para almoço ou compromissos.'),
     shot('02-agenda'))

page('Agenda', 'Agendar uma cliente', 'Toque em <b>Agendar</b> no topo da Agenda ou do painel.',
     steps(['Cliente nova? <b>Cadastrar nova cliente</b> sem sair da tela.', 'Escolha a <b>cliente</b>.', 'Escolha o <b>serviço</b>: a duração vem preenchida.', 'Defina <b>data e horário</b>.', 'Toque em <b>Confirmar agendamento</b>.'])
     + tip('Se o horário já estiver ocupado, o sistema avisa. Dois atendimentos ao mesmo tempo só ficam marcados se você confirmar.', 'Atenção'),
     shot('03-agendar'))

page('Agenda', 'Detalhes do agendamento', 'Toque em uma cliente na agenda para abrir esta janela.',
     steps(['Mude a <b>situação</b>: confirmado, a confirmar ou cancelado.', '<b>Confirmar pelo WhatsApp</b>: mensagem pronta de confirmação.', '<b>Lembrete pelo WhatsApp</b>: lembra a cliente do horário.', '<b>Remarcar</b> para outro dia ou hora.', '<b>Concluir atendimento</b> quando terminar.'])
     + tip('<i>Editar agendamento</i> corrige serviço, duração ou observações.'),
     shot('02b-detalhe'))

page('Agenda', 'Mensagem pronta no WhatsApp', 'O sistema escreve a mensagem e você revisa antes de enviar.',
     steps(['<b>Contexto da cliente</b>: preferências, próximo horário e último atendimento.', 'Confira o <b>telefone</b> do WhatsApp.', 'Edite o texto ou toque em <b>Copiar texto</b>.', '<b>Abrir no WhatsApp</b>: a conversa abre com a mensagem pronta.'])
     + tip('Existem mensagens prontas para confirmação, lembrete, cobrança e pós-atendimento.'),
     shot('12-whatsapp-mensagem'))

page('Atendimento', 'Concluir um atendimento', 'São três etapas rápidas, logo depois da visita.',
     steps(['Siga as etapas: <b>Atendimento → Produtos → Pagamento</b>.', 'Marque os <b>serviços realizados</b> (pode ser mais de um).', 'Informe o <b>preço total combinado</b> da visita.', 'Toque em <b>Continuar</b> até confirmar.'])
     + tip('Na etapa Produtos, informe o que usou (g, ml ou unidades): o estoque baixa sozinho. No Pagamento, aceita sinal, valor parcial e cartão parcelado.'),
     shot('04-concluir'))

page('Atendimento', 'Clientes', 'Cadastro, histórico e saldo de cada cliente.',
     steps(['<b>Busque</b> por nome ou telefone.', '<b>Novo cliente</b> para cadastrar.', 'Toque no <b>nome</b> para abrir a ficha.', '<b>Exportar</b> a lista em planilha.'])
     + tip('Também dá para importar clientes por CSV (botão <i>Importar CSV</i>).', 'Saiba'),
     shot('05-clientes'))

page('Atendimento', 'Ficha da cliente', 'Tudo sobre a cliente em uma janela.',
     steps(['<b>Abas</b>: Perfil, Conversas, Agenda, Serviços e Pagamentos.', '<b>Avisos importantes</b> (ex.: sensibilidade) ficam em destaque.', '<b>WhatsApp</b>: mensagem livre com o contexto da cliente.', '<b>Editar cadastro</b> para corrigir dados.', '<b>Agendar</b> direto da ficha.']),
     shot('06-cliente'))

page('Dinheiro', 'Financeiro', 'Dinheiro que entrou, o que falta receber e as despesas.',
     steps(['Escolha o <b>período</b> (mês) ou <i>Todo o período</i>.', '<b>Indicadores</b>: recebido, despesas, resultado e custo de consumo.', '<b>Novo registro</b>: pagamento, despesa ou sinal.', '<b>Exportar</b> para planilha ou PDF.'])
     + tip('Toque em qualquer valor destacado para ver os registros que formam aquele número.'),
     shot('07-financeiro'))

page('Dinheiro', 'Gráficos do Financeiro', 'Entenda o mês de um jeito visual.',
     steps(['<b>Entradas e saídas</b> dos últimos 6 meses.', '<b>Por forma de pagamento</b>: Pix, dinheiro, cartão.', '<b>Por serviço</b>: quais serviços trazem mais.', '<b>Despesas por categoria</b>: para onde vai o dinheiro.'])
     + tip('Toque em <i>Ver em tabela</i> para ver os números exatos.', 'Saiba'),
     shot('08-graficos'))

page('Dinheiro', 'Receber de uma cliente', 'Na aba <b>A receber de clientes</b>, toque em <b>Receber</b>.',
     steps(['Informe o <b>valor pago</b>.', 'Confira a <b>data</b> do pagamento.', 'Escolha a <b>forma</b>: Pix, dinheiro, transferência ou cartão.', 'Toque em <b>Confirmar pagamento</b>.'])
     + tip('No cartão, a cliente fica quitada e o sistema cria os <b>repasses</b> a conferir quando o dinheiro cair na sua conta (aba <i>Repasses do cartão</i>).'),
     shot('09-receber'))

page('Ateliê', 'Estoque', 'Produtos em gramas, mililitros ou unidades.',
     steps(['<b>Registrar compra</b>: entra no estoque e vira despesa.', '<b>Cadastrar produto</b> novo.', '<b>Estoque baixo</b>: o que precisa repor.', '<b>Movimentações</b>: entradas, consumos e perdas.'])
     + tip('O consumo de cada atendimento baixa o estoque sozinho e guarda o custo daquele dia.', 'Saiba'),
     shot('10-estoque'))

page('Ateliê', 'Serviços e histórico', 'Veja o que foi feito e organize seu catálogo.',
     steps(['<b>Procedimentos realizados</b> no dia, mês ou em todo o histórico.', '<b>Catálogo de serviços</b>: preço e duração de cada serviço.', 'Troque entre <b>Dia</b>, <b>Mês inteiro</b> e <b>Todo o histórico</b>.', '<b>Concluir atendimento</b> também por aqui.']),
     shot('13-servicos'))

page('Ateliê', 'Atendimentos e notas internas', 'Organize conversas e anotações das clientes.',
     steps(['<b>Notas internas</b>: suas anotações sobre cada conversa.', 'Toque na <b>conversa</b> para ver o histórico.', '<b>Resolver</b> tira a pendência da lista (não envia nada à cliente).'])
     + tip('Avisos de segurança, como sensibilidade após um procedimento, ficam em vermelho.', 'Atenção'),
     shot('11-notas'))

page('WhatsApp no sistema', 'Passo 1 · Instalar o conector', 'Para receber e responder as clientes <b>dentro do sistema</b>. É gratuito e feito uma vez só.',
     steps(['Em <b>Atendimentos → WhatsApp → Conectar por QR Code</b>, toque em <b>Baixar conector e instruções</b>.', 'No computador do ateliê, rode o <b>instalador</b>. Ele copia a <b>chave</b> sozinho.', 'Volte ao sistema, cole a chave (<b>Ctrl+V</b>) e toque em <b>Preparar QR Code</b>.'])
     + tip('Não envie a chave por chat ou e-mail. O computador precisa ficar ligado e com internet para as mensagens chegarem ao sistema.', 'Atenção'),
     shot('21-whatsapp-conectar'))

page('WhatsApp no sistema', 'Passo 2 · Ler o QR Code', 'Em alguns segundos o QR aparece na tela.',
     steps(['No celular, abra o <b>WhatsApp</b>.', 'Vá em <b>Configurações → Aparelhos conectados → Conectar um aparelho</b>.', 'Aponte a câmera para o <b>QR Code</b> da tela.', 'Pronto: aparece <b>WhatsApp conectado</b>.'])
     + tip('Faça o primeiro teste com um <b>número de teste</b>. O QR expira rápido: se precisar, toque em <i>Gerar novo QR Code</i>.'),
     shot('22-whatsapp-qr'))

page('WhatsApp no sistema', 'Passo 3 · Responder as clientes', 'As conversas novas chegam sozinhas na aba WhatsApp.',
     steps(['Escolha a <b>conversa</b> na lista.', 'Escreva a resposta ou <b>anexe</b> imagem ou áudio.', 'Toque em <b>Enviar mensagem</b>.', 'Acompanhe: <i>Na fila do conector → Aceita → Entregue → Lida</i>.', '<b>Resolver</b> quando terminar o assunto.'])
     + tip('Apareceu <b>“Sem confirmação”</b>? Confira no celular antes de mandar de novo: o sistema nunca reenvia sozinho.', 'Atenção'),
     shot('23-whatsapp-conversa'))

page('Cuidados', 'Editar e excluir com segurança', 'Abra um registro e use <b>Editar</b> ou <b>Excluir</b>. Também existe <b>Excluir registro</b> no topo das telas.',
     steps(['O sistema mostra <b>tudo</b> o que será apagado junto.', 'Marque <b>“Conferi a lista”</b>.', 'Digite a <b>senha da conta</b>: só você consegue excluir.', 'Toque em <b>Excluir definitivamente</b>.'])
     + tip('Excluir não tem desfazer. Na dúvida, faça antes uma <b>cópia completa</b> em Configurações. Errou só um valor? Prefira <b>Editar</b>.', 'Atenção'),
     shot('14b-excluir-senha'))

page('Cuidados', 'Configurações e cópias de segurança', 'Ajuste o ateliê e guarde seus dados.',
     steps(['<b>Preparar operação</b>: expediente, conta do espaço e saldos iniciais.', '<b>Exportar dados</b> em planilha (CSV).', '<b>Cópia completa JSON</b>: guarde uma vez por semana.', '<b>Aparência</b>: tema claro ou escuro.'])
     + tip('A cópia completa também serve para levar os dados para outra hospedagem (<i>Restaurar cópia JSON</i>).', 'Saiba'),
     shot('15-config'))

page('Do seu jeito', 'Tema escuro', 'Mais conforto à noite ou em ambientes com pouca luz.',
     steps(['Toque em <b>Escuro</b> no topo da tela.', 'A escolha fica salva neste aparelho.', 'Para voltar, toque em <b>Claro</b>.']),
     shot('16-escuro'))

pages.append(f'''<section class="page phones-page"><div class="left"><div class="chip">Do seu jeito</div><h2>No celular</h2><p class="lead">O sistema foi feito primeiro para o celular.</p>{steps(['Use a <b>barra inferior</b>: Início, Agenda, Conversas, Financeiro e Mais.', 'Toque em <b>Mais</b> para Estoque, Serviços, Orçamentos e Configurações.', 'Dica: adicione o site à <b>tela inicial</b> para abrir como um app.'])}</div><div class="right phones">{''.join(f'<div class="phone"><img src="{IMG}{n}.jpg"></div>' for n in ['17-cel-inicio','18-cel-agenda','19-cel-conversas'])}</div><footer><span>Manual Hanne · Gestão do ateliê</span><span class="num"></span></footer></section>''')

routine = [('Ao começar o dia', ['Confira se está nos <b>dados reais</b>.', 'Veja a <b>agenda</b> e as pendências do painel.', 'Envie <b>confirmações e lembretes</b> pelo WhatsApp.']),
           ('Depois de cada visita', ['Toque em <b>Concluir atendimento</b>.', 'Informe os <b>produtos usados</b>.', 'Registre o <b>pagamento</b> (ou o saldo em aberto).']),
           ('No fim do dia', ['Compare recebimentos com <b>comprovantes</b>.', 'Confirme <b>repasses do cartão</b> e despesas pagas.', 'Olhe o <b>estoque baixo</b> antes de comprar.'])]
pages.append('<section class="page routine"><div class="chip">Do seu jeito</div><h2>Rotina sugerida</h2><p class="lead">Poucos minutos por dia mantêm tudo em ordem.</p><div class="cols">' + ''.join(f'<div class="col"><span class="big">{i+1}</span><h3>{t}</h3><ul>' + ''.join(f'<li>{x}</li>' for x in xs) + '</ul></div>' for i, (t, xs) in enumerate(routine)) + '</div>' + tip('Uma vez por semana: <b>Configurações → Cópia completa JSON</b>. Guarde o arquivo no Google Drive ou no e-mail.') + '<footer><span>Manual Hanne · Gestão do ateliê</span><span class="num"></span></footer></section>')

faq = [('Errei um valor ou um nome.', 'Abra o registro e toque em <b>Editar</b>. O sistema só deixa salvar se os saldos continuarem certos.'),
       ('Esqueci a senha.', 'Na tela de entrada, toque em <b>Esqueci minha senha</b> e use o código de configuração.'),
       ('A mensagem ficou “Na fila do conector”.', 'O computador do ateliê está desligado ou sem internet. Ela sai quando ele voltar.'),
       ('Apareceu “Sem confirmação”.', 'Confira no celular se a mensagem foi. O sistema <b>nunca</b> reenvia sozinho.'),
       ('Estou vendo dados que não são meus.', 'É a <b>demonstração</b>. Toque em <i>Usar dados reais</i>.'),
       ('Apareceu “Conflito” ao salvar.', 'O sistema foi alterado em outro aparelho. Atualize a página; seu rascunho é preservado.')]
pages.append('<section class="page faq"><div class="chip">Do seu jeito</div><h2>Dúvidas rápidas</h2><div class="faq-grid">' + ''.join(f'<div class="q"><h3>{q}</h3><p>{a}</p></div>' for q, a in faq) + '</div><p class="end">Seu tempo para o que importa. 💜</p><footer><span>Manual Hanne · Gestão do ateliê</span><span class="num"></span></footer></section>')

css = open('/tmp/manual/style.css').read()
doc = f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Manual Hanne</title><style>{css}</style></head><body>{"".join(pages)}<script>document.querySelectorAll(".page").forEach((p,i)=>{{const n=p.querySelector(".num");if(n)n.textContent=String(i+1).padStart(2,"0")}})</script></body></html>'
open('/tmp/manual/manual.html', 'w').write(doc)
print(len(pages), 'páginas')
