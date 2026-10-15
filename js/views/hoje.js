// Tela Hoje: o dia inteiro em uma página. Primeiro a assistente (conte o dia ou pergunte),
// depois o que já está registrado, a tarefa sugerida e os atalhos.
import { state, actions, registrarFeito, abrir, fechar, aviso, uid, texto } from '../core.js?v=6';
import { html, attr, icon, topo, campo, resumo, dataLonga, dataCurta, duracao, dinheiro, n } from '../ui.js?v=6';
import { seletor } from '../widgets.js?v=6';
import { hoje, somaDias, inicioSemana, candidatos, planoDoDia, faseDe, resumoSemana, somaMacros, AREAS, TIPOS, progressoDoJogo } from '../logic.js?v=6';
import { balancoDoDia } from '../analise.js?v=6';
import { caixaDaAssistente } from './assistente.js?v=6';

const MODOS = [
  [5, '5 min', 'Dia difícil'],
  [30, '30 min', 'Dia normal'],
  [90, '90 min', 'Dia livre'],
  [0, 'Descanso', 'Sem tarefa'],
];

const MOTIVOS = {
  clientes: 'Aproxima do primeiro cliente.',
  produto: 'Deixa a demo pronta para mostrar.',
  conteudo: 'Mantém o ritmo de vídeos da semana.',
  revisao: 'Fecha a semana e escolhe só 3 prioridades.',
  organizacao: 'Tira atrito das próximas semanas.',
  pessoal: 'Coisa sua, fora do projeto.',
  sistema: 'Melhoria interna: só depois do que traz cliente.',
};

const motivo = (c) =>
  c.tipo === 'lead'
    ? `Follow-up marcado para ${dataCurta(c.desde)}.${c.detalhe ? ` Próximo passo: ${c.detalhe}` : ''}`
    : c.prazo
      ? `Prazo: ${dataCurta(c.prazo)}.`
      : MOTIVOS[c.area];

const maiuscula = (s) => s[0].toUpperCase() + s.slice(1);
const diaDe = (d) => (state.dias[d] ||= {});
const lista = (d) => candidatos(state, d, state.dias[d]?.modo || 90);

function cartao(c) {
  const rodando = state.timer?.chave === c.chave;
  return html`
    <section class="card tarefa" aria-labelledby="tarefa-titulo">
      <p class="meta">${AREAS[c.area]} · ${c.min}&nbsp;min</p>
      <h3 id="tarefa-titulo">${c.titulo}</h3>
      <p class="motivo">${motivo(c)}</p>
      ${rodando && html`<p class="timer"><span class="num" id="timer" data-inicio="${state.timer.inicio}">${duracao(Date.now() - state.timer.inicio)}</span> em andamento</p>`}
      <div class="acoes">
        ${c.tipo === 'lead'
          ? html`<button class="btn btn-p" data-act="lead.abrir" data-id="${c.id}">Registrar follow-up</button>`
          : html`<button class="btn btn-p" data-act="hoje.concluir" data-chave="${c.chave}">${icon('check')} Concluir</button>`}
        ${!rodando && c.tipo !== 'lead' && html`<button class="btn btn-s" data-act="hoje.comecar" data-chave="${c.chave}">${icon('play')} Começar</button>`}
      </div>
      <div class="acoes-sec">
        <button class="btn btn-t" data-act="hoje.trocar" data-chave="${c.chave}">${icon('arrows-clockwise', 18)} Trocar</button>
        <button class="btn btn-t" data-act="hoje.adiar" data-chave="${c.chave}">Adiar</button>
        ${c.tipo === 'plano' && html`<button class="btn btn-t" data-act="hoje.editarPlano">Editar</button>`}
      </div>
    </section>`;
}

function semTarefa(d) {
  const pulou = state.dias[d]?.pulos?.length;
  return html`
    <section class="card">
      <h3>${pulou ? 'Acabaram as opções de hoje' : 'Nada cabe nesse tempo'}</h3>
      <p class="motivo">${pulou ? 'Você trocou ou adiou tudo o que cabia.' : 'Cadastre uma tarefa curta para dias assim.'}</p>
      <div class="acoes">
        ${pulou && html`<button class="btn btn-s" data-act="hoje.recomecar">Ver a lista de novo</button>`}
        <a class="btn btn-s" href="#/tarefas">Tarefas</a>
      </div>
    </section>`;
}

export const formPlano = (p, act, extra) => html`
  <form class="dlg-corpo" data-act="${act}" ${extra}>
    ${seletor('Área', 'area', AREAS, p?.area)}
    ${campo('Em 5 min', html`<input name="t5" value="${p?.t5 || ''}" autocomplete="off">`)}
    ${campo('Em 30 min', html`<input name="t30" value="${p?.t30 || ''}" autocomplete="off">`)}
    ${campo('Em 90 min', html`<input name="t90" value="${p?.t90 || ''}" autocomplete="off">`)}
    <footer class="dlg-acoes"><button class="btn btn-p">Salvar plano</button></footer>
  </form>`;

// Tudo que já entrou no app hoje, em uma lista só: é aqui que a pessoa vê o resultado do que contou.
function registradoHoje(d, dia) {
  const treinos = state.treinos.filter((t) => t.data === d);
  const refeicoes = state.refeicoes.filter((r) => r.data === d).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  const feitos = state.feitos.filter((f) => f.data === d);
  // Compra parcelada aparece uma vez só, pela primeira parcela.
  const lancamentos = state.financas.filter((l) => l.data === d && (!l.parcela || l.parcela.startsWith('1/')));
  const peso = state.medidas.filter((m) => m.data === d).at(-1);
  const kcal = somaMacros(refeicoes).kcal;
  const { metaKcal } = state.settings;
  const balanco = balancoDoDia(state, d);
  const nada = treinos.length + refeicoes.length + feitos.length + lancamentos.length === 0 && !peso && !dia.nota;
  const linha = (rotulo, titulo, lado, act, id) => html`
    <li>
      <${act ? 'button' : 'span'} class="linha" ${act && html`data-act="${act}" data-id="${id}"`}>
        <span class="principal">${titulo}</span>
        <span class="lado">${lado}</span>
        <span class="detalhe">${rotulo}</span>
      </${act ? 'button' : 'span'}>
    </li>`;

  return html`
    <section class="bloco" aria-labelledby="h-registrado">
      <h2 id="h-registrado" class="com-lado">Registrado hoje${refeicoes.length > 0 && html`<small>${n(kcal)}${metaKcal > 0 && html` de ${n(metaKcal)}`} kcal</small>`}</h2>
      <p class="nota"><a href="#/registros">Ver e editar registros de outros dias ↗</a></p>
      ${nada
        ? html`<p class="nota">Nada ainda. Conte o seu dia para a assistente, ou use os atalhos mais abaixo.</p>`
        : html`
          <ul class="linhas compacta">
            ${treinos.map((t) => linha('Treino', t.tipo || 'Treino', t.min ? `${t.min} min` : '', 'treino.abrir', t.id))}
            ${refeicoes.map((r) => linha('Refeição', r.nome, html`<b class="num">${n(r.kcal)}</b> kcal`, 'comida.abrir', r.id))}
            ${feitos.map((f) => html`<li><button class="linha" data-act="registro.abrir" data-lista="feitos" data-id="${f.id}"><span class="principal">${f.titulo}</span><span class="lado">Editar</span><span class="detalhe">${AREAS[f.area]} · ${f.min || 0} min</span></button></li>`)}
            ${lancamentos.map((l) => linha(TIPOS[l.tipo], l.descricao || TIPOS[l.tipo], l.parcela ? `${l.parcela.split('/')[1]}x de ${dinheiro(l.valor)}` : dinheiro(l.valor), 'fin.abrir', l.id))}
            ${peso && html`<li><button class="linha" data-act="registro.abrir" data-lista="medidas" data-id="${peso.id}"><span class="principal">${peso.peso} kg</span><span class="lado">Editar</span><span class="detalhe">Peso</span></button></li>`}
          </ul>
          ${balanco.saldo != null && html`
            <p class="nota">Até agora, ${n(balanco.comeu)} kcal para um gasto estimado de ${n(balanco.gasto)} no dia. <a href="#/corpo/medidas">Ver o balanço</a></p>`}
          ${dia.nota && html`
            <details class="relato">
              ${resumo('Relato do dia')}
              <p class="citacao">${dia.nota}</p>
              <div class="acoes"><button class="btn btn-s" data-act="registro.abrir" data-lista="dias" data-id="${d}">Editar relato</button><button class="btn btn-s" data-act="hoje.virarVideo">Virar vídeo</button></div>
            </details>`}`}
    </section>`;
}

export function render() {
  const d = hoje();
  const dia = state.dias[d] || {};
  const fase = faseDe(state, d);
  const { cicloInicio, cicloFim, videosSemana } = state.settings;
  const sub = fase
    ? `${fase.nome}, até ${dataCurta(fase.ate)}`
    : d < cicloInicio
      ? `O ciclo começa em ${dataCurta(cicloInicio)}`
      : `Ciclo encerrado em ${dataCurta(cicloFim)}`;
  const tarefaFeita = state.feitos.some((f) => f.data === d && /^(plano|task):/.test(f.chave || ''));
  const proxima = dia.modo ? lista(d)[0] : null;
  const s = resumoSemana(state, d);
  const prioridades = state.revisoes[somaDias(inicioSemana(d), -7)]?.prioridades;
  const treinou = state.treinos.some((t) => t.data === d);
  const jogo = progressoDoJogo(state, d);

  return html`
    ${topo(maiuscula(dataLonga(d)), sub)}

    <section class="jogo-missoes" aria-label="Missões de hoje">
      <div class="jogo-missoes-topo"><h2>Missões de hoje</h2><span>${jogo.missoes.filter((m) => m.feito).length}/${jogo.missoes.length} concluídas</span></div>
      <div class="jogo-missao-lista">${jogo.missoes.map((m) => html`<a class="jogo-missao ${m.feito ? 'concluida' : ''}" href="${m.link}"><span class="jogo-missao-icone" aria-hidden="true">${m.feito ? '✓' : '◇'}</span><span>${m.nome}<small>${m.feito ? 'Concluída' : 'Missão disponível'}</small></span><b>+${m.xp} XP</b></a>`)}</div>
      <small>XP por ação, vídeo e dia de treino ou alimentação. Publicar um vídeo rende mais 70 XP. Descanso não tira pontos.</small>
    </section>

    ${caixaDaAssistente()}
    ${registradoHoje(d, dia)}

    <section class="bloco" aria-label="Tarefa do dia">
      <fieldset class="seg">
        <legend>Tarefa do dia: quanto tempo você tem?</legend>
        ${MODOS.map(([v, rotulo, dica]) => html`
          <label>
            <input type="radio" name="modo" value="${v}" data-mudou="hoje.modo" ${attr('checked', dia.modo === v)}>
            <span><b>${rotulo}</b><small>${dica}</small></span>
          </label>`)}
      </fieldset>
      ${dia.modo === undefined
        ? html`<p class="dica">Escolha o tempo e aparece uma tarefa só.</p>`
        : dia.modo === 0
          ? html`<section class="card"><h3>Descanso registrado</h3><p class="motivo">Nada pendente hoje e nada acumula para amanhã.</p></section>`
          : !proxima
            ? semTarefa(d)
            : tarefaFeita
              ? html`<details class="mais-uma">${resumo('Tarefa de hoje feita. Fazer mais uma')}${cartao(proxima)}</details>`
              : cartao(proxima)}
    </section>

    <section class="bloco" aria-labelledby="h-atalhos">
      <h2 id="h-atalhos">Atalhos</h2>
      <div class="acoes atalhos">
        <label class="btn btn-s">${icon('camera')} Foto da refeição<input class="sr" type="file" accept="image/*" capture="environment" data-mudou="comida.foto"></label>
        <button class="btn btn-s" data-act="treino.novo">${icon('barbell')} ${treinou ? 'Registrar outra atividade' : 'Registrar treino'}</button>
        <button class="btn btn-s" data-act="fin.novo">${icon('plus')} Lançar dinheiro</button>
      </div>
    </section>

    <section class="bloco" aria-labelledby="h-semana">
      <h2 id="h-semana">Esta semana</h2>
      <dl class="stats">
        <div><dt>ações comerciais</dt><dd class="num">${s.comerciais}</dd></div>
        <div><dt>vídeos publicados</dt><dd class="num">${s.videos}<small>/${videosSemana}</small></dd></div>
        <div><dt>treinos</dt><dd class="num">${s.treinos}${s.treinosPlanejados > 0 && html`<small>/${s.treinosPlanejados}</small>`}</dd></div>
      </dl>
      ${prioridades && html`<p class="prioridades"><b>Prioridades da semana</b>${prioridades}</p>`}
      <p class="mais-link"><a href="#/metricas">Ver métricas e gráficos</a></p>
    </section>`;
}

Object.assign(actions, {
  'hoje.modo': ({ valor }) => {
    const dia = diaDe(hoje());
    dia.modo = Number(valor);
    dia.descanso = dia.modo === 0;
  },

  'hoje.comecar': ({ chave }) => {
    state.timer = { chave, inicio: Date.now() };
  },

  'hoje.concluir': ({ chave }) => {
    const d = hoje();
    const c = lista(d).find((x) => x.chave === chave);
    if (!c) return;
    // Com cronômetro, vale o tempo real; sem ele, a estimativa da tarefa.
    const min = state.timer?.chave === chave ? Math.max(1, Math.round((Date.now() - state.timer.inicio) / 60000)) : c.min;
    registrarFeito({ ...c, min });
    if (c.tipo === 'task') state.tasks.find((t) => t.id === c.id).feitaEm = d;
    state.timer = null;
    aviso('Feito. Se quiser, pode fechar o app por hoje.');
  },

  'hoje.trocar': ({ chave }) => {
    (diaDe(hoje()).pulos ||= []).push(chave);
  },

  // Adiar é uma escolha, não uma dívida: sai de hoje e volta amanhã como tarefa comum.
  'hoje.adiar': ({ chave }) => {
    const d = hoje();
    const amanha = somaDias(d, 1);
    const c = lista(d).find((x) => x.chave === chave);
    if (!c) return;
    if (c.tipo === 'lead') state.leads.find((l) => l.id === c.id).followUp = amanha;
    else if (c.tipo === 'task') state.tasks.find((t) => t.id === c.id).adiadaAte = amanha;
    else {
      state.tasks.push({ id: uid(), titulo: c.titulo, area: c.area, min: c.min, criadaEm: d, adiadaAte: amanha });
      (diaDe(d).pulos ||= []).push(chave);
    }
    if (state.timer?.chave === chave) state.timer = null;
  },

  'hoje.recomecar': () => {
    diaDe(hoje()).pulos = [];
  },

  'hoje.editarPlano': () => {
    abrir('Plano de hoje', formPlano(planoDoDia(state, hoje()), 'hoje.salvarPlano'));
    return false;
  },

  'hoje.salvarPlano': (f) => {
    state.plano[hoje()] = { area: f.area, t5: texto(f.t5), t30: texto(f.t30), t90: texto(f.t90) };
    fechar();
  },

  'hoje.virarVideo': () => {
    const nota = state.dias[hoje()]?.nota;
    if (!nota) return false;
    state.videos.push({ id: uid(), quadro: 'lancer', titulo: nota.split('\n')[0].slice(0, 60), relato: nota, status: 'relato', previsto: '', criadoEm: hoje(), pubs: {} });
    aviso('Vídeo criado em Conteúdo com este relato.');
  },
});
