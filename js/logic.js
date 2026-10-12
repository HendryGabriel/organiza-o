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
  custo: 'Custo',
  imposto: 'Imposto',
  reserva: 'Aporte na reserva do Lancer',
  retirada: 'Retirada da reserva',
};

// O placar só anda com aporte registrado: receber não é reservar, e "a receber" não conta em lugar nenhum.
export function financas(lancamentos) {
  const soma = (tipo, filtro = () => true) =>
    lancamentos.filter((l) => l.tipo === tipo && filtro(l)).reduce((s, l) => s + l.valor, 0);
  const recebido = soma('receita', (l) => l.recebido !== false);
  const custos = soma('custo');
  const impostos = soma('imposto');
  return {
    recebido,
    aReceber: soma('receita', (l) => l.recebido === false),
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

// ---------- Semana ----------

export function resumoSemana(state, ref) {
  const ini = inicioSemana(ref);
  const fim = somaDias(ini, 6);
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
    videos: new Set(posts).size,
    posts: posts.length,
    treinos: state.treinos.filter((t) => na(t.data)).length,
    treinosPlanejados: state.settings.diasTreino.length,
    descansos: Object.entries(state.dias).filter(([d, v]) => na(d) && v.descanso).length,
    kcalMedia: diasComida ? Math.round(refeicoes.reduce((s, r) => s + r.kcal, 0) / diasComida) : null,
    leadsNovos: state.leads.filter((l) => na(l.criadoEm)).length,
    financas: financas(state.financas.filter((l) => na(l.data))),
  };
}
