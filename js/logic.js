// Regras puras do app (sem DOM nem localStorage), para rodar também em `node --test`.

// Datas sempre como 'YYYY-MM-DD' no fuso do aparelho. toISOString() usaria UTC e viraria o dia às 21h no Brasil.
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseData = (s) => new Date(`${s}T12:00:00`);
export const hoje = () => iso(new Date());
export const somaDias = (s, n) => {
  const d = parseData(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const diaSemana = (s) => parseData(s).getDay(); // 0 = domingo
export const inicioSemana = (s) => somaDias(s, -((diaSemana(s) + 6) % 7)); // segunda-feira

// "1.250,50" -> 1250.5 | "1.250" -> 1250 | "80.5" -> 80.5 | vazio ou lixo -> NaN
export function num(v) {
  let s = String(v ?? '').trim().replace(/[^\d.,-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return s === '' ? NaN : Number(s);
}
// Dinheiro é guardado em centavos inteiros para a soma nunca errar por ponto flutuante.
export const centavos = (v) => Math.round(num(v) * 100);

// ---------- Tarefa do dia ----------

// A ordem das chaves é a ordem de recomendação: o que traz cliente vem antes de mexer no próprio sistema.
export const AREAS = {
  clientes: 'Clientes',
  produto: 'Produto',
  conteudo: 'Conteúdo',
  revisao: 'Revisão',
  organizacao: 'Organização',
  pessoal: 'Pessoal',
  sistema: 'Sistema',
};
const ORDEM = Object.keys(AREAS);
export const COMERCIAIS = ['clientes', 'produto'];

export const planoDoDia = (state, data) => state.plano[data] || state.rotina[diaSemana(data)];

export function faseDe(state, data) {
  const { cicloInicio, cicloFim } = state.settings;
  if (data < cicloInicio || data > cicloFim) return null;
  return state.fases.find((f) => data <= f.ate) ?? null;
}

// Lista ordenada do que cabe em `modo` minutos. A primeira é a tarefa do dia; "Trocar" anda na lista.
// Tarefa do plano só existe no próprio dia: o que passou não vira dívida.
export function candidatos(state, data, modo) {
  const fora = new Set([
    ...(state.dias[data]?.pulos || []),
    ...state.feitos.filter((f) => f.data === data).map((f) => f.chave),
  ]);
  const abertas = state.tasks.filter((t) => !t.feitaEm && t.min <= modo && !(t.adiadaAte > data));
  const venceu = (t) => t.prazo && t.prazo <= data;
  const tarefa = (t) => ({ chave: `task:${t.id}`, tipo: 'task', id: t.id, titulo: t.titulo, area: t.area, min: t.min, prazo: t.prazo });
  const plano = planoDoDia(state, data);
  return [
    ...state.leads
      .filter((l) => l.followUp && l.followUp <= data && !FECHADOS.includes(l.status))
      .sort((a, b) => a.followUp.localeCompare(b.followUp))
      .map((l) => ({ chave: `lead:${l.id}`, tipo: 'lead', id: l.id, titulo: `Follow-up com ${l.empresa}`, area: 'clientes', min: 5, desde: l.followUp, detalhe: l.proximoPasso })),
    ...abertas.filter(venceu).sort((a, b) => a.prazo.localeCompare(b.prazo)).map(tarefa),
    ...[90, 30, 5]
      .filter((t) => t <= modo && plano?.[`t${t}`])
      .map((t) => ({ chave: `plano:${t}`, tipo: 'plano', titulo: plano[`t${t}`], area: plano.area, min: t })),
    ...abertas
      .filter((t) => !venceu(t))
      .sort((a, b) => ORDEM.indexOf(a.area) - ORDEM.indexOf(b.area) || b.min - a.min)
      .map(tarefa),
  ].filter((c) => !fora.has(c.chave));
}

// ---------- Prospecção ----------

export const ETAPAS = {
  pesquisado: 'Pesquisado',
  qualificado: 'Qualificado',
  abordado: 'Abordado',
  respondeu: 'Respondeu',
  interessado: 'Interessado',
  demo: 'Demo',
  proposta: 'Proposta',
  ganho: 'Ganho',
  sem_resposta: 'Sem resposta',
  nao_interessado: 'Não interessado',
  perdido: 'Perdido',
  nao_contatar: 'Não contatar',
};
export const FUNIL = ['pesquisado', 'qualificado', 'abordado', 'respondeu', 'interessado', 'demo', 'proposta', 'ganho'];
export const FECHADOS = ['ganho', 'perdido', 'nao_interessado', 'nao_contatar'];

// `auge` guarda a etapa mais avançada já alcançada, para as taxas não regredirem quando o lead é perdido.
export function mudarEtapa(lead, status) {
  const equivalente = { sem_resposta: 'abordado', nao_interessado: 'respondeu' }[status] || status;
  lead.status = status;
  lead.auge = Math.max(lead.auge ?? 0, FUNIL.indexOf(equivalente));
}

export function funil(leads) {
  const chegou = (etapa) => leads.filter((l) => (l.auge ?? 0) >= FUNIL.indexOf(etapa)).length;
  return {
    total: leads.length,
    abordados: chegou('abordado'),
    responderam: chegou('respondeu'),
    demos: chegou('demo'),
    propostas: chegou('proposta'),
    ganhos: leads.filter((l) => l.status === 'ganho').length,
  };
}

// Sem denominador não existe taxa: devolve null em vez de inventar 0%.
export const taxa = (parte, todo) => (todo > 0 ? parte / todo : null);

// ---------- Dinheiro ----------

export const TIPOS = {
  receita: 'Receita',
  custo: 'Gasto',
  imposto: 'Imposto',
  // Pagar a fatura não é gasto novo: os gastos são as compras que estão dentro dela (ver fluxoDoMes em analise.js).
  fatura: 'Pagamento da fatura do cartão',
  reserva: 'Aporte na reserva do Lancer',
  retirada: 'Retirada da reserva',
};

// De onde o dinheiro vem e para onde vai. Salário e gasto pessoal entram na análise do mês,
// nunca no placar do Lancer nem no resultado do negócio: esses só olham para "clientes" e "negocio".
export const RENDAS = { clientes: 'Clientes', salario: 'Salário', extra: 'Renda extra' };
export const GASTOS = {
  negocio: 'Negócio',
  moradia: 'Moradia',
  mercado: 'Mercado',
  comer_fora: 'Comer fora',
  transporte: 'Transporte',
  assinaturas: 'Assinaturas',
  saude: 'Saúde',
  lazer: 'Lazer',
  compras: 'Compras',
  educacao: 'Educação',
  dividas: 'Dívidas e parcelas',
  outros: 'Outros',
};
export const CATEGORIAS = { receita: RENDAS, custo: GASTOS };
const PADRAO = { receita: 'clientes', custo: 'negocio' };
// Lançamento antigo não tem categoria: antes só existia dinheiro do negócio. Imposto e reserva não têm categoria.
export const categoriaDe = (l) => (CATEGORIAS[l.tipo] ? (Object.hasOwn(CATEGORIAS[l.tipo], l.categoria) ? l.categoria : PADRAO[l.tipo]) : '');
const doNegocio = (l) => categoriaDe(l) === PADRAO[l.tipo];

// O placar só anda com aporte registrado: receber não é reservar, e "a receber" não conta em lugar nenhum.
export function financas(lancamentos) {
  const soma = (tipo, filtro = () => true) =>
    lancamentos.filter((l) => l.tipo === tipo && filtro(l)).reduce((s, l) => s + l.valor, 0);
  const recebido = soma('receita', (l) => l.recebido !== false && doNegocio(l));
  const custos = soma('custo', doNegocio);
  const impostos = soma('imposto');
  return {
    recebido,
    aReceber: soma('receita', (l) => l.recebido === false && doNegocio(l)),
    custos,
    impostos,
    resultado: recebido - custos - impostos,
    reservado: soma('reserva') - soma('retirada'),
  };
}

// ---------- Corpo ----------

export const somaMacros = (itens) =>
  itens.reduce((t, i) => ({ kcal: t.kcal + i.kcal, p: t.p + i.p, c: t.c + i.c, g: t.g + i.g }), { kcal: 0, p: 0, c: 0, g: 0 });

// Resposta do Gemini é entrada externa: nada dela entra no estado sem passar por aqui.
export function normalizarRefeicao(obj) {
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  const itens = (Array.isArray(obj?.itens) ? obj.itens : []).map((i) => ({
    nome: String(i?.nome || 'Item').slice(0, 80),
    porcao: String(i?.porcao || '').slice(0, 60),
    kcal: n(i?.kcal),
    p: n(i?.proteina),
    c: n(i?.carbo),
    g: n(i?.gordura),
  }));
  return {
    nome: String(obj?.nome || 'Refeição').slice(0, 80),
    itens,
    confianca: ['baixa', 'media', 'alta'].includes(obj?.confianca) ? obj.confianca : 'media',
    observacao: String(obj?.observacao || '').slice(0, 300),
  };
}

// ---------- Relato do dia ----------

export const CANAIS = ['WhatsApp', 'Instagram', 'E-mail', 'Ligação', 'Presencial', 'Outro'];

// O que a assistente devolve é entrada externa, como a refeição: só chega à tela de conferência
// o que tiver data, número e categoria que o app reconhece.
export function normalizarDia(obj, ref) {
  const s = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const lista = (v) => (Array.isArray(v) ? v : []).slice(0, 20);
  const minutos = (v) => Math.min(600, Math.max(0, Math.round(Number(v) || 0)));
  const um = (v, opcoes, padrao) => (opcoes.includes(v) ? v : padrao);
  const data = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && iso(parseData(v)) === v;
  // O relato é sobre hoje ou, no máximo, a última semana ("ontem treinei"). Fora disso, vale hoje.
  const dia = (v) => (data(v) && v >= somaDias(ref, -7) && v <= ref ? v : ref);
  // Próximo contato é o contrário: só no futuro, até um ano à frente.
  const adiante = (v) => (data(v) && v > ref && v <= somaDias(ref, 365) ? v : '');
  const peso = Number(obj?.peso);

  return {
    resposta: s(obj?.resposta, 2000),
    relato: s(obj?.relato, 4000),
    treinos: lista(obj?.treinos).map((t) => ({ data: dia(t?.data), tipo: s(t?.tipo, 60) || 'Treino', min: minutos(t?.minutos), obs: s(t?.observacao, 300) })),
    refeicoes: lista(obj?.refeicoes)
      .map((r) => {
        const { nome, itens } = normalizarRefeicao(r);
        return { data: dia(r?.data), nome, itens: itens.slice(0, 20) };
      })
      .filter((r) => r.itens.length > 0),
    acoes: lista(obj?.acoes)
      .map((a) => ({ data: dia(a?.data), titulo: s(a?.titulo, 120), area: um(a?.area, ORDEM, 'pessoal'), min: minutos(a?.minutos) }))
      .filter((a) => a.titulo),
    contatos: lista(obj?.contatos)
      .map((c) => ({
        data: dia(c?.data),
        empresa: s(c?.empresa, 80),
        canal: um(c?.canal, CANAIS, 'Outro'),
        resumo: s(c?.resumo, 300),
        respondeu: c?.respondeu === true,
        proximoPasso: s(c?.proximo_passo, 160),
        followUp: adiante(c?.proximo_contato),
      }))
      .filter((c) => c.empresa),
    // A IA manda reais; o app guarda centavos. Valor zerado ou absurdo não vira lançamento.
    financas: lista(obj?.financas)
      .map((f) => {
        const tipo = um(f?.tipo, Object.keys(TIPOS), '');
        // Cartão e parcelas só existem em gasto. O valor é o total da compra; a divisão em faturas é feita ao registrar.
        const cartao = tipo === 'custo' && f?.cartao === true;
        const parcelas = cartao ? Math.min(48, Math.max(1, Math.round(Number(f?.parcelas) || 1))) : 1;
        return { data: dia(f?.data), tipo, categoria: categoriaDe({ tipo, categoria: f?.categoria }), valor: Math.round(Math.abs(Number(f?.valor) || 0) * 100), descricao: s(f?.descricao, 120), cartao, parcelas };
      })
      .filter((f) => f.tipo && f.valor > 0 && f.valor <= 1e9),
    // Tarefa pedida à assistente ("me lembra de..."): prazo só de hoje em diante.
    tarefas: lista(obj?.tarefas)
      .map((t) => ({ titulo: s(t?.titulo, 120), area: um(t?.area, ORDEM, 'pessoal'), min: um(Number(t?.minutos), [5, 30, 90], 30), prazo: t?.prazo === ref ? ref : adiante(t?.prazo) }))
      .filter((t) => t.titulo),
    peso: peso >= 20 && peso <= 400 ? Math.round(peso * 10) / 10 : null,
  };
}

// ---------- Semana ----------

export function dataPublicacao(video) {
  const datas = Object.values(video.pubs || {}).map((p) => p.data).filter(Boolean).sort();
  return datas[0] || (['publicado', 'analisado'].includes(video.status) ? video.publicadoEm || video.criadoEm || '' : '');
}

export const dataRegistroVideo = (v) => v.registradoEm || (String(v.id || '').startsWith('pauta-') ? '' : v.criadoEm || '');

export function progressoDoJogo(state, ref) {
  const ateHoje = (data) => Boolean(data) && data <= ref;
  const dias = (lista) => new Set(lista.map((r) => r.data).filter(ateHoje)).size;
  const xp = state.feitos.filter((f) => ateHoje(f.data)).length * 25
    + dias(state.treinos) * 50 + dias(state.refeicoes) * 15
    + state.videos.filter((v) => ateHoje(dataRegistroVideo(v))).length * 30
    + state.videos.filter((v) => ateHoje(dataPublicacao(v))).length * 70;
  const missoes = [
    { nome: 'Concluir uma ação', xp: 25, feito: state.feitos.some((f) => f.data === ref), link: '#/hoje' },
    { nome: 'Registrar um treino', xp: 50, feito: state.treinos.some((t) => t.data === ref), link: '#/corpo/treino' },
    { nome: 'Registrar alimentação', xp: 15, feito: state.refeicoes.some((r) => r.data === ref), link: '#/corpo/comida' },
    { nome: 'Criar um vídeo', xp: 30, feito: state.videos.some((v) => dataRegistroVideo(v) === ref), link: '#/conteudo' },
  ];
  return { xp, nivel: 1 + Math.floor(xp / 250), atual: xp % 250, proximo: 250, missoes };
}

export function resumoSemana(state, ref, limites) {
  const ini = inicioSemana(ref);
  const fim = somaDias(ini, 6);
  return resumoDoPeriodo(state, limites && limites[0] > ini ? limites[0] : ini, limites && limites[1] < fim ? limites[1] : fim);
}

export function resumoDoPeriodo(state, ini, fim) {
  const na = (d) => d >= ini && d <= fim;
  const feitos = state.feitos.filter((f) => na(f.data));
  const minutos = {};
  for (const f of feitos) minutos[f.area] = (minutos[f.area] || 0) + (f.min || 0);
  // Um vídeo publicado em três plataformas é 1 vídeo e 3 posts.
  const posts = state.videos.flatMap((v) => Object.values(v.pubs || {}).filter((p) => p.data && na(p.data)).map(() => v.id));
  const refeicoes = state.refeicoes.filter((r) => na(r.data));
  const diasComida = new Set(refeicoes.map((r) => r.data)).size;
  return {
    ini,
    fim,
    feitos,
    minutos,
    comerciais: feitos.filter((f) => COMERCIAIS.includes(f.area)).length,
    videos: state.videos.filter((v) => na(dataPublicacao(v))).length,
    videosRegistrados: state.videos.filter((v) => na(dataRegistroVideo(v))).length,
    posts: posts.length,
    treinos: state.treinos.filter((t) => na(t.data)).length,
    treinosPlanejados: state.settings.diasTreino.length,
    descansos: Object.entries(state.dias).filter(([d, v]) => na(d) && v.descanso).length,
    kcalMedia: diasComida ? Math.round(refeicoes.reduce((s, r) => s + r.kcal, 0) / diasComida) : null,
    leadsNovos: state.leads.filter((l) => na(l.criadoEm)).length,
    financas: financas(state.financas.filter((l) => na(l.data))),
  };
}
