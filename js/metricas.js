// Números por trás dos gráficos. Regras puras (sem DOM), para rodar também em `node --test`.
// Todo gráfico no tempo usa a mesma unidade do app: a semana, de segunda a domingo.
import { somaDias, parseData, inicioSemana, resumoSemana, financas, funil, taxa, somaMacros, COMERCIAIS } from './logic.js?v=6';
import { balancoDoDia } from './analise.js?v=6';

// As `n` semanas que terminam na semana de `ref`, da mais antiga para a atual (segunda-feira de cada uma).
export const semanasAte = (ref, n) => [...Array(n)].map((_, i) => somaDias(inicioSemana(ref), -7 * (n - 1 - i)));

export function serieSemanal(state, semanas, limites) {
  return semanas.map((semana) => {
    const ini = limites && limites[0] > semana ? limites[0] : semana;
    const fim = limites && limites[1] < somaDias(semana, 6) ? limites[1] : somaDias(semana, 6);
    const r = resumoSemana(state, semana, limites);
    const conteudo = r.feitos.filter((f) => f.area === 'conteudo').length;
    const pesos = state.medidas.filter((m) => m.data >= ini && m.data <= fim).sort((a, b) => a.data.localeCompare(b.data));
    const qtdDias = Math.round((parseData(fim) - parseData(ini)) / 864e5) + 1;
    const balancos = [...Array(qtdDias)].map((_, i) => balancoDoDia(state, somaDias(ini, i))).filter((d) => d.comeu != null && d.gasto != null);
    return {
      ini,
      fim,
      negocio: r.comerciais,
      conteudo,
      outras: r.feitos.length - r.comerciais - conteudo,
      minNegocio: COMERCIAIS.reduce((t, a) => t + (r.minutos[a] || 0), 0),
      minConteudo: r.minutos.conteudo || 0,
      minTotal: Object.values(r.minutos).reduce((t, m) => t + m, 0),
      leads: r.leadsNovos,
      videos: r.videos,
      treinos: r.treinos,
      kcal: r.kcalMedia, // média por dia registrado; null se a semana não tem refeição
      gasto: balancos.length ? Math.round(balancos.reduce((t, d) => t + d.gasto, 0) / balancos.length) : null,
      peso: pesos.at(-1)?.peso ?? null, // última medida da semana
      recebido: r.financas.recebido,
      custos: r.financas.custos + r.financas.impostos,
      // A reserva é um saldo: o ponto de cada semana é tudo que foi reservado até o domingo dela.
      reservado: financas(state.financas.filter((l) => l.data <= fim)).reservado,
    };
  });
}

// Série semanal pronta para um gráfico: as semanas, os rótulos curtos (eixo) e os longos (dica e tabela).
export function ultimasSemanas(state, ref, n, curta) {
  const serie = serieSemanal(state, semanasAte(ref, n));
  return {
    serie,
    rotulos: serie.map((s) => curta(s.ini)),
    longos: serie.map((s) => `Semana de ${curta(s.ini)} a ${curta(s.fim)}`),
    destaque: 'semana atual',
  };
}

export const soma = (serie, campo) => serie.reduce((t, s) => t + (s[campo] || 0), 0);

// Calorias por dia, do mais antigo para hoje. Dia sem refeição fica null (não é zero caloria).
export function kcalPorDia(state, ref, dias) {
  return [...Array(dias)].map((_, i) => {
    const data = somaDias(ref, -(dias - 1 - i));
    const doDia = state.refeicoes.filter((r) => r.data === data);
    return { data, kcal: doDia.length ? somaMacros(doDia).kcal : null };
  });
}

export function caloriasPorDia(state, ref, dias) {
  return [...Array(dias)].map((_, i) => balancoDoDia(state, somaDias(ref, -(dias - 1 - i))));
}

// Funil dos leads criados a partir de `desde`: quantos chegaram a cada etapa e a passagem de uma para a outra.
export function funilDoPeriodo(leads, desde) {
  const f = funil(leads.filter((l) => l.criadoEm >= desde));
  const etapas = [
    ['Pesquisados', f.total, null, ''],
    ['Abordados', f.abordados, f.total, 'pesquisados'],
    ['Responderam', f.responderam, f.abordados, 'abordados'],
    ['Demos', f.demos, f.responderam, 'respostas'],
    ['Propostas', f.propostas, f.demos, 'demos'],
    ['Clientes', f.ganhos, f.propostas, 'propostas'],
  ];
  return etapas.map(([nome, valor, base, deQue]) => ({ nome, valor, base, deQue, taxa: base == null ? null : taxa(valor, base) }));
}

// Topo "redondo" para o eixo: 3 vira 4, 7 vira 10, 1.250 vira 2.000.
export function teto(max) {
  if (!(max > 0)) return 1;
  const potencia = 10 ** Math.floor(Math.log10(max));
  const fator = max / potencia;
  return [1, 2, 4, 5, 10].find((f) => fator <= f + 1e-9) * potencia;
}
