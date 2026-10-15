// Análises do dinheiro e do corpo, e o resumo do app que acompanha cada conversa com a assistente.
// Regras puras, como logic.js e metricas.js: rodam também em `node --test`.
import { iso, parseData, hoje, somaDias, diaSemana, categoriaDe, financas, funil, taxa, somaMacros, resumoSemana, planoDoDia, RENDAS, GASTOS, ETAPAS, FECHADOS, AREAS, TIPOS } from './logic.js?v=6';
import { perfilDaIA } from './perfil.js?v=6';

const total = (lista) => lista.reduce((t, x) => t + x.valor, 0);

// ---------- Dinheiro: de onde vem, para onde vai ----------

export const mesDe = (data) => data.slice(0, 7);
export const mesAntes = (mes, n = 1) => {
  const d = parseData(`${mes}-15`);
  d.setMonth(d.getMonth() - n);
  return mesDe(iso(d));
};

const SAIDAS = { ...GASTOS, impostos: 'Impostos', cartao: 'Cartão sem detalhe' };

// ---------- Cartão de crédito ----------
// Compra no cartão pesa no mês em que a fatura é paga, não no dia da compra. Cada compra (ou parcela) guarda
// a `fatura` (AAAA-MM) em que cai. O pagamento da fatura é outro lançamento, do tipo "fatura".

// Em que mês uma compra é paga: a fatura fecha no dia `cartaoFecha` e vence no próximo dia `cartaoVence`.
// Compra feita no próprio dia do fechamento já entra na fatura seguinte.
// Sem os dias cadastrados vale a regra mais comum: paga no mês seguinte ao da compra.
export function faturaDe(data, { cartaoFecha: fecha, cartaoVence: vence } = {}) {
  const mes = mesDe(data);
  if (!(fecha >= 1 && vence >= 1)) return mesAntes(mes, -1);
  const fechaEm = Number(data.slice(8)) < fecha ? mes : mesAntes(mes, -1);
  return vence > fecha ? fechaEm : mesAntes(fechaEm, -1);
}

// Compra parcelada vira uma parcela por fatura. Os centavos que não dividem certinho vão para a primeira.
export function parcelar(valor, vezes, primeiraFatura) {
  const cada = Math.floor(valor / vezes);
  return [...Array(vezes)].map((_, i) => ({
    valor: cada + (i === 0 ? valor - cada * vezes : 0),
    fatura: mesAntes(primeiraFatura, -i),
    parcela: vezes > 1 ? `${i + 1}/${vezes}` : '',
  }));
}

// O que já está comprometido nas faturas depois de `mes`: parcelas e compras que ainda vão vencer.
export function proximasFaturas(lancamentos, mes, quantas = 6) {
  return [...Array(quantas)]
    .map((_, i) => mesAntes(mes, -(i + 1)))
    .map((m) => ({ mes: m, valor: total(lancamentos.filter((l) => l.tipo === 'custo' && l.cartao && l.fatura === m)) }))
    .filter((f) => f.valor > 0);
}
const agrupar = (lista, nomes) => {
  const soma = {};
  for (const { chave, valor } of lista) soma[chave] = (soma[chave] || 0) + valor;
  return Object.entries(soma)
    .map(([chave, valor]) => ({ chave, nome: nomes[chave], valor }))
    .sort((a, b) => b.valor - a.valor);
};

// O mês em três perguntas: de onde entrou, para onde saiu e quanto sobrou.
// `ateDia` corta o mês em um dia, para comparar o mês corrente com o mesmo trecho dos anteriores;
// `vencimento` é o dia em que a fatura do cartão costuma ser paga.
//
// Cartão sem contar em dobro: o gasto do cartão no mês é o MAIOR entre o que foi pago de fatura e a soma
// das compras lançadas naquela fatura. Compra lançada explica a fatura; o que a fatura tiver a mais do que
// as compras lançadas aparece como "Cartão sem detalhe". Assim dá no mesmo lançar só o pagamento, só as
// compras ou os dois.
export function fluxoDoMes(lancamentos, mes, ateDia = '31', vencimento = 10) {
  const doMes = lancamentos.filter((l) => l.data.startsWith(mes) && l.data.slice(8) <= ateDia);
  // Receita a receber não entra: só conta o que já caiu na conta.
  const entradas = agrupar(doMes.filter((l) => l.tipo === 'receita' && l.recebido !== false).map((l) => ({ chave: categoriaDe(l), valor: l.valor })), RENDAS);
  const tipo = (t) => total(doMes.filter((l) => l.tipo === t));
  const pago = tipo('fatura');
  // No mês cortado, a fatura entra se já foi paga ou se o dia do vencimento já passou.
  const temFatura = pago > 0 || String(vencimento).padStart(2, '0') <= ateDia;
  const noCartao = temFatura ? lancamentos.filter((l) => l.tipo === 'custo' && l.cartao && l.fatura === mes) : [];
  const detalhado = total(noCartao);
  const semDetalhe = Math.max(0, pago - detalhado);
  const saidas = agrupar(
    [
      ...doMes.filter((l) => l.tipo === 'custo' && !l.cartao).map((l) => ({ chave: categoriaDe(l), valor: l.valor })),
      ...noCartao.map((l) => ({ chave: categoriaDe(l), valor: l.valor })),
      ...doMes.filter((l) => l.tipo === 'imposto').map((l) => ({ chave: 'impostos', valor: l.valor })),
      ...(semDetalhe > 0 ? [{ chave: 'cartao', valor: semDetalhe }] : []),
    ],
    SAIDAS,
  );
  const entrou = total(entradas);
  const saiu = total(saidas);
  return { mes, entradas, saidas, entrou, saiu, sobra: entrou - saiu, guardado: tipo('reserva') - tipo('retirada'), cartao: { pago, detalhado, semDetalhe } };
}

export function fluxoDoIntervalo(lancamentos, inicio, fim, vencimento = 10) {
  const resultado = { entradas: [], saidas: [], entrou: 0, saiu: 0, sobra: 0, guardado: 0, cartao: { pago: 0, detalhado: 0, semDetalhe: 0 } };
  const grupos = { entradas: new Map(), saidas: new Map() };
  for (let mes = inicio.slice(0, 7); mes <= fim.slice(0, 7); mes = mesAntes(mes, -1)) {
    const ate = mes === fim.slice(0, 7) ? fim.slice(8) : '31';
    const antes = mes === inicio.slice(0, 7) ? String(Number(inicio.slice(8)) - 1).padStart(2, '0') : '00';
    const a = fluxoDoMes(lancamentos, mes, ate, vencimento), b = fluxoDoMes(lancamentos, mes, antes, vencimento);
    for (const campo of ['entrou', 'saiu', 'guardado']) resultado[campo] += a[campo] - b[campo];
    for (const campo of ['pago', 'detalhado', 'semDetalhe']) resultado.cartao[campo] += a.cartao[campo] - b.cartao[campo];
    for (const campo of ['entradas', 'saidas']) for (const [sinal, lista] of [[1, a[campo]], [-1, b[campo]]]) for (const linha of lista) {
      const anterior = grupos[campo].get(linha.nome) || { ...linha, valor: 0 };
      anterior.valor += sinal * linha.valor; grupos[campo].set(linha.nome, anterior);
    }
  }
  for (const campo of ['entradas', 'saidas']) resultado[campo] = [...grupos[campo].values()].filter((r) => r.valor !== 0).sort((a, b) => b.valor - a.valor);
  resultado.sobra = resultado.entrou - resultado.saiu;
  return resultado;
}

// Gastos que se decidem mês a mês. Moradia, parcelas, impostos e o negócio ficam de fora da lista de cortes.
const FIXOS = ['moradia', 'dividas', 'impostos', 'negocio'];

// Onde dá para economizar: os gastos variáveis do mês, do maior para o menor, cada um comparado com a média
// dele mesmo nos 3 meses anteriores (só os meses que têm lançamento). No mês corrente a comparação é com o
// mesmo trecho dos outros meses, senão todo começo de mês pareceria economia.
export function economia(lancamentos, mes, ref, vencimento = 10) {
  const ateDia = mes === mesDe(ref) ? ref.slice(8) : '31';
  const atual = fluxoDoMes(lancamentos, mes, '31', vencimento);
  const antes = [1, 2, 3]
    .map((n) => mesAntes(mes, n))
    .filter((m) => lancamentos.some((l) => l.data.startsWith(m)))
    .map((m) => fluxoDoMes(lancamentos, m, ateDia, vencimento));
  const linhas = atual.saidas
    .filter((s) => !FIXOS.includes(s.chave))
    .map((s) => {
      const media = antes.length ? Math.round(antes.reduce((t, f) => t + (f.saidas.find((x) => x.chave === s.chave)?.valor || 0), 0) / antes.length) : null;
      return { ...s, parte: taxa(s.valor, atual.saiu), media, acima: media == null ? null : s.valor - media };
    });
  return { linhas, meses: antes.length, parcial: ateDia !== '31', corte10: Math.round(total(linhas.slice(0, 3)) * 0.1) };
}

// ---------- Prospecção em dinheiro ----------

const PASSAGENS = [
  ['total', 'abordados', 'Da pesquisa para a abordagem', 'Há lead pesquisado sem abordagem. Abordar quem já está na lista é o passo mais barato.'],
  ['abordados', 'responderam', 'Da abordagem para a resposta', 'Pouca gente responde. Teste outra mensagem de abertura ou outro canal.'],
  ['responderam', 'demos', 'Da resposta para a demo', 'Quem responde não chega à demo. Ofereça a demonstração já na primeira resposta.'],
  ['demos', 'propostas', 'Da demo para a proposta', 'A demo não vira proposta. Termine a demo combinando o envio da proposta.'],
  ['propostas', 'ganhos', 'Da proposta para o fechamento', 'Proposta não fecha. Revise preço, escopo e o follow-up da proposta.'],
];

// Quanto a prospecção rende. Valor por abordagem só existe com cliente fechado: sem denominador não há conta.
export function prospeccaoEmDinheiro(state, ref) {
  const f = funil(state.leads);
  const receita = total(state.financas.filter((l) => l.tipo === 'receita' && l.recebido !== false && categoriaDe(l) === 'clientes'));
  // Primeira abordagem de cada lead: a atividade mais antiga (a lista guarda a mais nova na frente).
  const desde = somaDias(ref, -27);
  const novas = state.leads.filter((l) => {
    const primeira = l.atividades?.at(-1)?.data;
    return primeira >= desde && primeira <= ref;
  }).length;
  // O gargalo é a passagem com a menor taxa entre as que já têm base. Empate fica com a mais do começo do funil.
  const [pior] = PASSAGENS.map(([base, valor, nome, dica]) => ({ nome, dica, valor: f[valor], base: f[base], taxa: taxa(f[valor], f[base]) }))
    .filter((p) => p.base > 0)
    .sort((a, b) => a.taxa - b.taxa);
  const porAbordagem = f.ganhos > 0 && f.abordados > 0 ? Math.round(receita / f.abordados) : null;
  return {
    funil: f,
    receita,
    ticket: f.ganhos > 0 ? Math.round(receita / f.ganhos) : null,
    porAbordagem,
    abordagensPorCliente: f.ganhos > 0 ? Math.round(f.abordados / f.ganhos) : null,
    novasPorSemana: novas / 4,
    porMesNoRitmo: porAbordagem == null ? null : Math.round((novas / 4) * (52 / 12) * porAbordagem),
    gargalo: pior && pior.taxa < 1 ? pior : null,
  };
}

// ---------- Corpo: balanço de calorias e tendência do peso ----------

export const ROTINAS = { sentado: 'Sentado a maior parte do dia', leve: 'Em pé ou andando boa parte do dia', ativo: 'Trabalho físico' };
const FATOR = { sentado: 1.2, leve: 1.375, ativo: 1.55 };
const KCAL_POR_KG = 7700; // energia aproximada de 1 kg de gordura corporal

const diasEntre = (a, b) => Math.round((parseData(b) - parseData(a)) / 864e5);

// O peso que valia em um dia: a última medida até ele. Antes da primeira medida, vale a primeira.
export function pesoEm(medidas, data) {
  const ordem = [...medidas].sort((a, b) => a.data.localeCompare(b.data));
  return (ordem.filter((m) => m.data <= data).at(-1) || ordem[0])?.peso ?? null;
}

// Gasto de um dia sem treino: repouso (fórmula de Mifflin-St Jeor) vezes o fator da rotina.
// Sem sexo, idade, altura e peso não existe conta, e o app não chuta.
export function gastoBase({ sexo, idade, altura, rotina }, peso) {
  if (!(peso > 0) || !(altura > 0) || !(idade > 0) || !['m', 'f'].includes(sexo)) return null;
  const repouso = 10 * peso + 6.25 * altura - 5 * idade + (sexo === 'm' ? 5 : -161);
  return Math.round(repouso * (FATOR[rotina] || FATOR.sentado));
}

// ponytail: gasto do treino por tabela de MET escolhida pelo nome do treino; musculação quando o nome não diz nada.
// Trocar por kcal medida (relógio, cinta) se um dia o app receber esse dado.
const MET = [
  [/corr|trote/i, 8],
  [/caminh/i, 3.5],
  [/bike|bici|cicl|spinning|pedal/i, 7],
  [/futebol|futsal|society|basquete|v[oô]lei|t[eê]nis/i, 7],
  [/nata[cç]|nado/i, 7],
  [/jiu|muay|boxe|luta|jud[oô]/i, 8],
  [/hiit|cross|funcional/i, 8],
  [/yoga|ioga|along|pilates|mobilidade/i, 2.5],
];
export function categoriaDoTreino(treino) {
  if (['musculacao', 'cardio'].includes(treino.categoria)) return treino.categoria;
  return /corr|trote|caminh|bike|bici|cicl|spinning|pedal|esteira|el[ií]pt|c[aá]rdio|nata[cç]|nado|futebol|hiit|cross|funcional|luta|boxe|muay|jiu/i.test(treino.tipo || '') ? 'cardio' : 'musculacao';
}
export function gastoDoTreino(treino, peso) {
  if (!(peso > 0) || !(treino.min > 0)) return 0;
  const met = categoriaDoTreino(treino) === 'musculacao' ? 4.5 : (MET.find(([nome]) => nome.test(treino.tipo || ''))?.[1] ?? 6);
  // O gasto de base já conta o repouso dessa hora: aqui entra só o que o treino acrescenta.
  return Math.round((met - 1) * peso * (treino.min / 60));
}

// Um dia: o que entrou (refeições), o que saiu (base + treino) e o saldo. Saldo negativo é déficit.
// Dia sem refeição registrada não é dia de zero caloria: `comeu` e `saldo` ficam null.
export function balancoDoDia(state, data) {
  const refeicoes = state.refeicoes.filter((r) => r.data === data);
  const peso = pesoEm(state.medidas, data);
  const base = gastoBase(state.settings, peso);
  const atividades = state.treinos.filter((t) => t.data === data);
  const porCategoria = (categoria) => atividades.filter((t) => categoriaDoTreino(t) === categoria).reduce((s, t) => s + gastoDoTreino(t, peso), 0);
  const musculacao = peso > 0 ? porCategoria('musculacao') : null;
  const cardio = peso > 0 ? porCategoria('cardio') : null;
  const treino = (musculacao || 0) + (cardio || 0);
  const comeu = refeicoes.length ? somaMacros(refeicoes).kcal : null;
  const gasto = base == null ? null : base + treino;
  return { data, comeu, base, musculacao, cardio, treino, gasto, saldo: comeu != null && gasto != null ? comeu - gasto : null };
}

// Média dos dias com refeição registrada na janela. Hoje fica de fora: o dia ainda não acabou.
export function balancoDoPeriodo(state, ref, dias = 14) {
  const lista = [...Array(dias)].map((_, i) => balancoDoDia(state, somaDias(ref, -(dias - 1 - i))));
  const fechados = lista.filter((d) => d.comeu != null && d.data !== ref);
  const media = (campo, de = fechados) => (de.length ? Math.round(de.reduce((t, d) => t + d[campo], 0) / de.length) : null);
  const comGasto = fechados.filter((d) => d.saldo != null);
  return { dias: lista, registrados: fechados.length, comeu: media('comeu'), gasto: media('gasto', comGasto), saldo: media('saldo', comGasto) };
}

// Tendência do peso: a reta que melhor passa pelas medidas da janela. Pede pelo menos 2 medidas com 7 dias
// entre elas, porque de um dia para o outro o peso oscila mais por água do que por gordura.
export function tendenciaDoPeso(medidas, ref, dias = 30) {
  const desde = somaDias(ref, -dias);
  const pts = medidas
    .filter((m) => m.data >= desde && m.data <= ref)
    .map((m) => ({ data: m.data, x: diasEntre(desde, m.data), y: m.peso }))
    .sort((a, b) => a.x - b.x);
  if (pts.length < 2 || pts.at(-1).x - pts[0].x < 7) return null;
  const mx = pts.reduce((t, p) => t + p.x, 0) / pts.length;
  const my = pts.reduce((t, p) => t + p.y, 0) / pts.length;
  const porDia = pts.reduce((t, p) => t + (p.x - mx) * (p.y - my), 0) / pts.reduce((t, p) => t + (p.x - mx) ** 2, 0);
  return {
    kgPorSemana: porDia * 7,
    kcalPorDia: Math.round(porDia * KCAL_POR_KG), // negativo: o corpo está gastando mais do que recebe
    medidas: pts.length,
    de: pts[0].data,
    ate: pts.at(-1).data,
    atual: pts.at(-1).y,
  };
}

// Tendência com a janela mais curta que tiver dado suficiente: 30 dias, senão 90.
export const tendencia = (medidas, ref) => tendenciaDoPeso(medidas, ref, 30) || tendenciaDoPeso(medidas, ref, 90);

// Quando a meta chega, mantido o ritmo. null se não há meta, não há tendência ou o peso anda para o outro lado.
export function chegadaNaMeta(t, meta, ref) {
  if (!t || !(meta > 0)) return null;
  const falta = meta - t.atual;
  if (Math.abs(falta) < 0.05) return { falta: 0, semanas: 0, data: ref };
  if (Math.abs(t.kgPorSemana) < 0.02 || Math.sign(falta) !== Math.sign(t.kgPorSemana)) return { falta, semanas: null, data: null };
  const semanas = falta / t.kgPorSemana;
  return { falta, semanas, data: somaDias(ref, Math.round(semanas * 7)) };
}

// ---------- Assistente ----------

const reais = (centavos) => Math.round(centavos) / 100;
const emReais = (linhas) => Object.fromEntries(linhas.map((l) => [l.nome, reais(l.valor)]));
const NOME_DO_MES = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const um = (v, casas = 1) => (v == null ? null : Number(v.toFixed(casas)));

// Tudo que a assistente sabe do app vem daqui: é só com este resumo que ela responde.
// Dinheiro em reais (não em centavos) e listas curtas, para a pergunta caber no pedido.
export function contextoDaAssistente(state, ref = hoje()) {
  const mes = mesDe(ref);
  const vence = state.settings.cartaoVence || 10;
  const fluxo = fluxoDoMes(state.financas, mes, '31', vence);
  const passado = fluxoDoMes(state.financas, mesAntes(mes), '31', vence);
  const eco = economia(state.financas, mes, ref, vence);
  const negocio = financas(state.financas);
  const p = prospeccaoEmDinheiro(state, ref);
  const semana = resumoSemana(state, ref);
  const dia = balancoDoDia(state, ref);
  const quinzena = balancoDoPeriodo(state, ref, 14);
  const t = tendencia(state.medidas, ref);
  const chegada = chegadaNaMeta(t, state.settings.metaPeso, ref);
  const abertos = state.leads.filter((l) => !FECHADOS.includes(l.status));
  const { metaLancer, metaKcal, metaProteina, metaPeso, videosSemana } = state.settings;

  return {
    hoje: ref,
    sobreHendry: perfilDaIA(state.settings),
    diaDaSemana: DIAS[diaSemana(ref)],
    registradoHoje: {
      treinos: state.treinos.filter((x) => x.data === ref).map((x) => ({ tipo: x.tipo, minutos: x.min })),
      refeicoes: state.refeicoes.filter((x) => x.data === ref).map((x) => ({ nome: x.nome, kcal: x.kcal })),
      acoes: state.feitos.filter((x) => x.data === ref).map((x) => ({ titulo: x.titulo, area: AREAS[x.area] })),
      dinheiro: state.financas.filter((x) => x.data === ref).map((x) => ({ tipo: TIPOS[x.tipo], valor: reais(x.valor), descricao: x.descricao })),
      relato: state.dias[ref]?.nota || '',
    },
    planoDeHoje: planoDoDia(state, ref) || null,
    semana: {
      acoesComerciais: semana.comerciais,
      videosPublicados: semana.videos,
      metaDeVideos: videosSemana,
      treinos: semana.treinos,
      treinosPlanejados: semana.treinosPlanejados,
      leadsNovos: semana.leadsNovos,
    },
    dinheiroDoMes: {
      mes: NOME_DO_MES.format(parseData(`${mes}-15`)),
      entrouPorFonte: emReais(fluxo.entradas),
      saiuPorCategoria: emReais(fluxo.saidas),
      entrou: reais(fluxo.entrou),
      saiu: reais(fluxo.saiu),
      sobrou: reais(fluxo.sobra),
      guardadoNaReserva: reais(fluxo.guardado),
      mesAnterior: { entrou: reais(passado.entrou), saiu: reais(passado.saiu), sobrou: reais(passado.sobra), saiuPorCategoria: emReais(passado.saidas) },
      gastosVariaveis: eco.linhas.map((l) => ({ categoria: l.nome, valor: reais(l.valor), mediaDosMesesAnteriores: l.media == null ? null : reais(l.media) })),
      // Compras no cartão já estão dentro de saiuPorCategoria, no mês da fatura. Aqui é só o resumo da fatura.
      cartaoDeCredito: {
        faturaPagaNoMes: reais(fluxo.cartao.pago),
        comprasLancadasNaFatura: reais(fluxo.cartao.detalhado),
        proximasFaturasJaComprometidas: Object.fromEntries(proximasFaturas(state.financas, mes).map((f) => [f.mes, reais(f.valor)])),
      },
    },
    negocio: { recebidoDeClientes: reais(negocio.recebido), aReceber: reais(negocio.aReceber), custosEImpostos: reais(negocio.custos + negocio.impostos), resultado: reais(negocio.resultado) },
    lancer: { reservado: reais(negocio.reservado), meta: metaLancer ? reais(metaLancer) : null },
    prospeccao: {
      funil: { pesquisados: p.funil.total, abordados: p.funil.abordados, responderam: p.funil.responderam, demos: p.funil.demos, propostas: p.funil.propostas, clientes: p.funil.ganhos },
      gargalo: p.gargalo && `${p.gargalo.nome}: ${p.gargalo.valor} em ${p.gargalo.base}`,
      receitaPorAbordagem: p.porAbordagem == null ? null : reais(p.porAbordagem),
      receitaPorCliente: p.ticket == null ? null : reais(p.ticket),
      abordagensNovasPorSemana: um(p.novasPorSemana),
      followUpsVencidos: abertos.filter((l) => l.followUp && l.followUp <= ref).map((l) => l.empresa).slice(0, 15),
      leads: abertos.slice(0, 40).map((l) => ({ empresa: l.empresa, etapa: ETAPAS[l.status], proximoContato: l.followUp || null })),
    },
    corpo: {
      pesoAtual: pesoEm(state.medidas, ref),
      metaDePeso: metaPeso || null,
      tendenciaKgPorSemana: t && um(t.kgPorSemana, 2),
      saldoRealPeloPesoKcalPorDia: t && t.kcalPorDia,
      semanasAteAMeta: chegada?.semanas == null ? null : um(chegada.semanas),
      hoje: { comeuKcal: dia.comeu, gastoEstimadoKcal: dia.gasto, gastoDoTreinoKcal: dia.treino },
      ultimos14Dias: { diasComRefeicao: quinzena.registrados, mediaComeuKcal: quinzena.comeu, mediaGastoKcal: quinzena.gasto, saldoMedioKcal: quinzena.saldo },
      metaDeCalorias: metaKcal || null,
      metaDeProteina: metaProteina || null,
      perfilPreenchido: dia.base != null,
    },
    tarefasAbertas: state.tasks.filter((x) => !x.feitaEm).slice(0, 15).map((x) => ({ titulo: x.titulo, prazo: x.prazo || null })),
  };
}

// ---------- Lembretes ----------

// O que o service worker precisa para montar um lembrete com o app fechado: os próximos 8 dias, já resolvidos.
// Fica guardado no próprio aparelho (cache), nunca vai para a rede.
export function resumoDosLembretes(state, ref) {
  const dias = {};
  for (let i = 0; i < 8; i++) {
    const d = somaDias(ref, i);
    dias[d] = {
      followUps: state.leads.filter((l) => l.followUp && l.followUp <= d && !FECHADOS.includes(l.status)).map((l) => l.empresa).slice(0, 5),
      prazos: state.tasks.filter((t) => !t.feitaEm && t.prazo === d).map((t) => t.titulo).slice(0, 5),
      treino: state.settings.diasTreino.includes(diaSemana(d)),
      tarefa: planoDoDia(state, d)?.t30 || '',
    };
  }
  const datas = [...state.treinos, ...state.refeicoes, ...state.feitos].map((x) => x.data).filter((d) => d <= ref);
  return { dias, ultimoRegistro: datas.sort().at(-1) || '' };
}
