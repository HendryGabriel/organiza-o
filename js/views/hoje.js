import { state, actions, registrarFeito, abrir, fechar, aviso, uid, texto } from '../core.js';
import { html, attr, icon, topo, campo, resumo, dataLonga, dataCurta, duracao, n } from '../ui.js';
import { seletor } from '../widgets.js';
import { hoje, somaDias, inicioSemana, candidatos, planoDoDia, faseDe, resumoSemana, somaMacros, diaSemana, AREAS } from '../logic.js';

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
      <h2 id="tarefa-titulo">${c.titulo}</h2>
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
      <h2>${pulou ? 'Acabaram as opções de hoje' : 'Nada cabe nesse tempo'}</h2>
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

export function render() {
  const d = hoje();
  const dia = state.dias[d] || {};
  const fase = faseDe(state, d);
  const { cicloInicio, cicloFim, videosSemana, metaKcal } = state.settings;
  const sub = fase
    ? `${fase.nome}, até ${dataCurta(fase.ate)}`
    : d < cicloInicio
      ? `O ciclo começa em ${dataCurta(cicloInicio)}`
      : `Ciclo encerrado em ${dataCurta(cicloFim)}`;
  const feitos = state.feitos.filter((f) => f.data === d);
  const proxima = dia.modo ? lista(d)[0] : null;
  const s = resumoSemana(state, d);
  const prioridades = state.revisoes[somaDias(inicioSemana(d), -7)]?.prioridades;
  const kcal = somaMacros(state.refeicoes.filter((r) => r.data === d)).kcal;
  const treinou = state.treinos.some((t) => t.data === d);
  const diaDeTreino = state.settings.diasTreino.includes(diaSemana(d));

  return html`
    ${topo(maiuscula(dataLonga(d)), sub)}

    <fieldset class="seg">
      <legend>Quanto tempo você tem hoje?</legend>
      ${MODOS.map(([v, rotulo, dica]) => html`
        <label>
          <input type="radio" name="modo" value="${v}" data-mudou="hoje.modo" ${attr('checked', dia.modo === v)}>
          <span><b>${rotulo}</b><small>${dica}</small></span>
        </label>`)}
    </fieldset>

    ${feitos.length > 0 && html`
      <section class="feito" aria-label="Feito hoje">
        <h2>${icon('check')} Dia concluído</h2>
        <ul>${feitos.map((f) => html`<li>${f.titulo}</li>`)}</ul>
      </section>`}

    ${dia.modo === undefined
      ? html`<p class="dica">Escolha o tempo e aparece uma tarefa só.</p>`
      : dia.modo === 0
        ? html`<section class="card"><h2>Descanso registrado</h2><p class="motivo">Nada pendente hoje e nada acumula para amanhã.</p></section>`
        : !proxima
          ? semTarefa(d)
          : feitos.length
            ? html`<details class="mais-uma">${resumo('Fazer mais uma')}${cartao(proxima)}</details>`
            : cartao(proxima)}

    <section class="bloco" aria-labelledby="h-semana">
      <h2 id="h-semana">Esta semana</h2>
      <dl class="stats">
        <div><dt>ações comerciais</dt><dd class="num">${s.comerciais}</dd></div>
        <div><dt>vídeos publicados</dt><dd class="num">${s.videos}<small>/${videosSemana}</small></dd></div>
        <div><dt>treinos</dt><dd class="num">${s.treinos}${s.treinosPlanejados > 0 && html`<small>/${s.treinosPlanejados}</small>`}</dd></div>
      </dl>
      ${prioridades && html`<p class="prioridades"><b>Prioridades da semana</b>${prioridades}</p>`}
      <p class="mais-link"><a href="#/metricas">Ver métricas e gráficos</a></p>
    </section>

    <section class="bloco" aria-labelledby="h-corpo">
      <h2 id="h-corpo">Corpo</h2>
      <p class="linha-solta">
        <span><b class="num">${n(kcal)}</b>${metaKcal > 0 && html` de ${n(metaKcal)}`}&nbsp;kcal hoje</span>
        <span>${treinou ? 'Treino feito' : diaDeTreino ? 'Dia de treino' : 'Sem treino planejado'}</span>
      </p>
      <div class="acoes iguais">
        <label class="btn btn-s">${icon('camera')} Foto da refeição<input class="sr" type="file" accept="image/*" capture="environment" data-mudou="comida.foto"></label>
        ${!treinou && html`<button class="btn btn-s" data-act="treino.novo">${icon('barbell')} Registrar treino</button>`}
      </div>
    </section>

    <section class="bloco" aria-labelledby="h-relato">
      <h2 id="h-relato">Relato do dia</h2>
      <form data-act="hoje.relato" class="pilha">
        <label class="campo">
          <span>O que aconteceu de verdade hoje?</span>
          <textarea name="nota" rows="3" placeholder="Ex.: mandei 2 abordagens, ninguém respondeu ainda…">${dia.nota || ''}</textarea>
        </label>
        <div class="acoes">
          <button class="btn btn-s" name="destino" value="dia">Salvar no dia</button>
          <button class="btn btn-t" name="destino" value="video">Virar vídeo</button>
        </div>
      </form>
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

  'hoje.relato': ({ nota, destino }) => {
    nota = texto(nota);
    if (!nota) return aviso('Escreva o relato primeiro.'), false;
    diaDe(hoje()).nota = nota;
    if (destino !== 'video') return aviso('Relato salvo.');
    state.videos.push({ id: uid(), quadro: 'lancer', titulo: nota.slice(0, 60), relato: nota, status: 'relato', previsto: '', criadoEm: hoje(), pubs: {} });
    aviso('Vídeo criado em Conteúdo com este relato.');
  },
});
