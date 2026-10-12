// Monta o texto do lembrete com o resumo que o app deixou guardado no aparelho.
// Roda em três lugares: no service worker (importScripts), na página e nos testes do Node.
// Por isso este arquivo não tem import nem export: ele pendura a função em `self`.
self.montarLembrete = function (resumo, agora) {
  const dois = (v) => String(v).padStart(2, '0');
  const hoje = `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
  const dia = (resumo && resumo.dias && resumo.dias[hoje]) || { followUps: [], prazos: [], treino: false, tarefa: '' };
  const lista = (itens, um, varios) => (itens.length === 1 ? `${um}: ${itens[0]}` : `${itens.length} ${varios}: ${itens.slice(0, 3).join(', ')}`);

  // De manhã: o que tem para hoje. O resumo guarda os próximos 8 dias; mais velho que isso, vale o texto geral.
  if (agora.getHours() < 15) {
    const partes = [];
    if (dia.followUps.length) partes.push(lista(dia.followUps, 'Follow-up', 'follow-ups'));
    if (dia.prazos.length) partes.push(lista(dia.prazos, 'Vence hoje', 'tarefas vencem hoje'));
    if (dia.treino) partes.push('Dia de treino');
    if (dia.tarefa) partes.push(`Tarefa do dia: ${dia.tarefa}`);
    return { title: 'Seu dia', body: partes.join('. ') || 'Abra o app e veja a tarefa de hoje.', tag: 'manha', url: './#/hoje' };
  }

  // À noite: lembrar de contar o dia. No domingo, também a revisão da semana.
  const registrou = Boolean(resumo) && resumo.ultimoRegistro === hoje;
  const domingo = agora.getDay() === 0;
  return {
    title: registrou ? 'Dia registrado' : 'Como foi o seu dia?',
    body:
      (registrou ? 'Faltou alguma coisa? Conte para a assistente.' : 'Conte por texto ou áudio: a assistente organiza treino, comida, gastos e contatos.') +
      (domingo ? ' Hoje também é dia da revisão da semana.' : ''),
    tag: 'noite',
    url: domingo && registrou ? './#/semana' : './#/hoje',
  };
};
