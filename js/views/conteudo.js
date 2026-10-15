import { state, actions, abrir, fechar, aviso, uid, texto } from '../core.js?v=4';
import { html, icon, topo, campo, vazio, dataMedia, dataCurta } from '../ui.js?v=4';
import { seletor, calendario } from '../widgets.js?v=4';
import { hoje, resumoSemana, dataPublicacao, dataRegistroVideo } from '../logic.js?v=4';
import { ultimasSemanas } from '../metricas.js?v=4';
import { barras } from '../graficos.js?v=4';
import { gerarRoteiro } from '../gemini.js?v=4';
import { perfilDaIA } from '../perfil.js?v=4';

export const STATUS = {
  ideia: 'Ideia',
  relato: 'Relato registrado',
  roteiro: 'Roteiro',
  narracao: 'Narração',
  edicao: 'Edição',
  agendado: 'Agendado',
  publicado: 'Publicado',
  analisado: 'Analisado',
};
const QUADROS = { lancer: 'Até o Lancer', gostoso: 'Ficando Gostoso', bastidores: 'Bastidores' };
const PLATAFORMAS = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube Shorts' };
const NO_AR = ['publicado', 'analisado'];
const FILTROS = { producao: 'Em produção', todos: 'Todos', ...STATUS };
const MUNDOS = {
  lancer: { icone: 'gauge', simbolo: '🏎️', nome: 'Garagem do Lancer', cor: 'lancer' },
  gostoso: { icone: 'barbell', simbolo: '⚡', nome: 'Arena da evolução', cor: 'gostoso' },
  bastidores: { icone: 'film-slate', simbolo: '🎬', nome: 'Base de operações', cor: 'bastidores' },
};
const PASSOS = ['Capturar a ideia', 'Escrever o roteiro', 'Gravar a narração', 'Editar o vídeo', 'Agendar a publicação', 'Publicar o vídeo', 'Analisar o resultado', 'Missão concluída'];
const etapaDe = (v) => Math.max(0, Object.keys(STATUS).indexOf(v.status));

let filtro = 'producao';
let quadro = 'todos';

function cartaVideo(v) {
  const mundo = MUNDOS[v.quadro] || MUNDOS.bastidores;
  const etapa = etapaDe(v);
  const publicado = Boolean(dataPublicacao(v));
  return html`<li class="video-carta ${mundo.cor}">
    <button class="video-carta-botao" data-act="video.abrir" data-id="${v.id}" aria-label="Abrir vídeo: ${v.titulo}">
      <span class="video-capa"><span class="video-capa-grade"></span><span class="video-mundo">${QUADROS[v.quadro] || 'Bastidores'}</span><span class="video-emblema">${icon(mundo.icone, 58)}</span><span class="video-capa-rodape"><span>${publicado ? 'NO AR' : 'EM PRODUÇÃO'}</span><b>${publicado ? '✓' : String(etapa + 1).padStart(2, '0')}</b></span></span>
      <span class="video-carta-corpo"><span class="video-etapa">${STATUS[v.status] || 'Ideia'}<span>${etapa + 1}/8</span></span><strong>${v.titulo}</strong>
        <span class="video-etapas" aria-label="Etapa ${etapa + 1} de 8">${Object.keys(STATUS).map((_, i) => html`<i class="${i <= etapa ? 'aceso' : ''}"></i>`)}</span>
        <span class="video-proxima">${PASSOS[etapa]}</span><span class="video-carta-fim"><span>${v.previsto ? dataMedia(v.previsto) : 'Sem data prevista'}</span><b>${publicado ? 'Ver missão' : 'Continuar'} ↗</b></span>
      </span>
    </button>
  </li>`;
}

function formVideo(v) {
  const novo = !v;
  v ||= { quadro: 'lancer', status: 'ideia', pubs: {} };
  return html`
    <form class="dlg-corpo" data-act="video.salvar" data-id="${v.id || ''}">
      ${campo('Título ou tema', html`<input name="titulo" required value="${v.titulo || ''}" autocomplete="off">`)}
      <div class="dupla">
        ${seletor('Quadro', 'quadro', QUADROS, v.quadro)}
        ${seletor('Etapa', 'status', STATUS, v.status)}
      </div>
      ${calendario('Data prevista', 'previsto', v.previsto)}
      ${calendario('Data de publicação', 'publicadoEm', dataPublicacao(v))}
      <small>Ao marcar Publicado ou Analisado, esta data conta para a meta. Sem data preenchida, vale hoje. Ideias e vídeos em produção aparecem como registrados.</small>

      ${campo('Relato', html`<textarea name="relato" rows="4" placeholder="Ex.: testei a demo com um escritório fictício e o agendamento falhou…">${v.relato || ''}</textarea>`, 'O que aconteceu de verdade. O roteiro sai daqui e de mais nada.')}
      <button type="button" class="btn btn-s" data-act="video.ia">Gerar roteiro com IA</button>

      ${campo('Gancho', html`<input name="gancho" value="${v.gancho || ''}" autocomplete="off">`)}
      ${campo('Roteiro narrado', html`<textarea name="roteiro" rows="7">${v.roteiro || ''}</textarea>`, 'Gancho, contexto, ação e resultado ou próximo passo. Duração inicial: 20 a 45 segundos.')}
      ${campo('Takes', html`<textarea name="takes" rows="4" placeholder="Um take por linha…">${v.takes || ''}</textarea>`, 'Só em casa ou na academia. Nunca o ambiente ou as telas do emprego.')}
      ${campo('Legenda', html`<textarea name="legenda" rows="2">${v.legenda || ''}</textarea>`)}
      ${campo('CTA', html`<input name="cta" value="${v.cta || ''}" autocomplete="off">`)}

      <fieldset class="grupo">
        <legend>Publicações</legend>
        ${Object.entries(PLATAFORMAS).map(([p, nome]) => html`
          <div class="dupla">
            ${calendario(nome, `pub-${p}-data`, v.pubs[p]?.data)}
            ${campo('Link', html`<input type="url" name="pub-${p}-url" value="${v.pubs[p]?.url || ''}" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://…">`)}
          </div>`)}
        <small>O mesmo vídeo em 3 plataformas conta como 1 vídeo e 3 posts.</small>
      </fieldset>

      <footer class="dlg-acoes">
        ${!novo && html`<button type="button" class="btn btn-t perigo" data-act="video.excluir" data-id="${v.id}">Excluir</button>`}
        <button class="btn btn-p">Salvar vídeo</button>
      </footer>
    </form>`;
}

export function render() {
  const s = resumoSemana(state, hoje());
  const noAr = state.videos.filter((v) => dataPublicacao(v));
  const posts = noAr.reduce((t, v) => t + Object.values(v.pubs || {}).filter((p) => p.data).length, 0);
  const semanas = ultimasSemanas(state, hoje(), 8, dataCurta);
  const meta = Math.max(1, state.settings.videosSemana || 2);
  const progresso = Math.min(100, Math.round(s.videos / meta * 100));
  const conteudoXp = state.videos.filter((v) => dataRegistroVideo(v) && dataRegistroVideo(v) <= hoje()).length * 30 + noAr.filter((v) => dataPublicacao(v) <= hoje()).length * 70;
  const visiveis = state.videos
    .filter((v) => (filtro === 'todos' ? true : filtro === 'producao' ? !NO_AR.includes(v.status) : v.status === filtro))
    .filter((v) => quadro === 'todos' || v.quadro === quadro)
    .sort((a, b) => (a.previsto || '9').localeCompare(b.previsto || '9'));
  const proximo = visiveis.find((v) => !dataPublicacao(v));

  return html`
    ${topo('Conteúdo', 'Seu estúdio. Suas missões. Sua evolução.')}
    <section class="conteudo-hero" aria-label="Missão semanal de conteúdo">
      <div class="conteudo-hero-texto"><span class="conteudo-kicker">🎮 MODO CRIADOR</span><h2>Transforme a sua<br>história em conteúdo.</h2><p>Cada vídeo é uma missão: da primeira ideia até o mundo ver.</p><button class="btn" data-act="video.novo">${icon('plus')} Criar nova missão</button><span class="conteudo-xp">✦ ${conteudoXp} XP em conteúdo <small>+30 ao registrar · +70 ao publicar</small></span></div>
      <div class="conteudo-meta"><div class="conteudo-anel" style="--progresso:${progresso}%" role="progressbar" aria-label="Vídeos publicados nesta semana" aria-valuemin="0" aria-valuemax="${meta}" aria-valuenow="${Math.min(s.videos, meta)}"><span>🎬<b>${s.videos}<small>/${meta}</small></b></span></div><strong>${s.videos >= meta ? 'Missão semanal concluída!' : 'Missão da semana'}</strong><span>Publicar ${meta} ${meta === 1 ? 'vídeo' : 'vídeos'}</span></div>
    </section>
    <div class="conteudo-inventario" aria-label="Seus resultados"><div><span>📝</span><b>${s.videosRegistrados}</b><small>registrados na semana</small></div><div><span>🚀</span><b>${s.videos}</b><small>publicados na semana</small></div><div><span>🎬</span><b>${noAr.length}</b><small>vídeos no ar</small></div><div><span>📡</span><b>${posts}</b><small>posts nas plataformas</small></div></div>

    <section class="conteudo-mundos" aria-label="Filtrar por quadro"><div class="conteudo-titulo"><h2>Escolha seu mundo</h2><button class="btn btn-t" data-act="video.quadro" data-valor="todos" aria-pressed="${quadro === 'todos'}">Ver todos</button></div><div class="conteudo-mundos-grade">${Object.entries(MUNDOS).map(([chave, mundo]) => html`<button class="conteudo-mundo ${mundo.cor} ${quadro === chave ? 'selecionado' : ''}" data-act="video.quadro" data-valor="${chave}" aria-pressed="${quadro === chave}"><span class="mundo-simbolo" aria-hidden="true">${mundo.simbolo}</span><span><strong>${mundo.nome}</strong><small>${QUADROS[chave]} · ${state.videos.filter((v) => v.quadro === chave).length} vídeos</small></span><b>↗</b></button>`)}</div></section>

    <section class="conteudo-mapa" aria-label="Etapas da produção"><div class="conteudo-titulo"><h2>Mapa de produção</h2><span>Escolha uma fase para ver os vídeos</span></div><div class="conteudo-fases">${Object.entries(STATUS).map(([chave, nome], i) => html`<button class="conteudo-fase ${filtro === chave ? 'selecionada' : ''}" data-act="video.filtro" data-valor="${chave}" aria-pressed="${filtro === chave}"><span>${String(i + 1).padStart(2, '0')}</span><strong>${nome}</strong><small>${state.videos.filter((v) => v.status === chave && (quadro === 'todos' || v.quadro === quadro)).length} vídeos</small></button>`)}</div></section>

    ${proximo && html`<section class="conteudo-proxima"><span class="proxima-icone" aria-hidden="true">⚔️</span><div><span class="conteudo-kicker">PRÓXIMA MISSÃO</span><h2>${proximo.titulo}</h2><p>${PASSOS[etapaDe(proximo)]} · ${QUADROS[proximo.quadro] || 'Bastidores'}</p></div><button class="btn btn-p" data-act="video.abrir" data-id="${proximo.id}">Continuar missão ↗</button></section>`}

    ${noAr.length > 0 && html`
      <details class="bloco"><summary>Seu histórico de publicações</summary>
        ${barras({
          ...semanas,
          titulo: 'Vídeos publicados por semana',
          series: [{ nome: 'Vídeos', valores: semanas.serie.map((x) => x.videos) }],
          meta: { valor: state.settings.videosSemana, rotulo: `meta ${state.settings.videosSemana}` },
          vazio: 'Nenhum vídeo publicado nas últimas 8 semanas.',
        })}
      </details>`}

    <div class="barra">
      ${seletor('Filtrar por etapa', 'filtro', FILTROS, filtro, { mudou: 'video.filtro', oculto: true })}
      <span class="conteudo-contagem">${visiveis.length} ${visiveis.length === 1 ? 'missão' : 'missões'} · ${quadro === 'todos' ? 'Todos os mundos' : QUADROS[quadro]}</span>
    </div>

    ${visiveis.length === 0
      ? vazio('Nenhum vídeo nessa etapa.')
      : html`
        <ul class="video-cartas" aria-label="Missões de conteúdo">${visiveis.map(cartaVideo)}</ul>`}
    <section class="conteudo-conquistas" aria-label="Conquistas de conteúdo"><h2>Sala de conquistas</h2><div>${[
      ['🌱', 'Primeiro passo', 'Registrar seu primeiro vídeo', conteudoXp > 0],
      ['🚀', 'No mundo', 'Publicar seu primeiro vídeo', noAr.length > 0],
      ['🏆', 'Semana completa', `Publicar ${meta} vídeos nesta semana`, s.videos >= meta],
    ].map(([simbolo, nome, dica, conquistado]) => html`<article class="conteudo-conquista ${conquistado ? 'conquistada' : ''}"><span aria-hidden="true">${simbolo}</span><strong>${nome}</strong><small>${dica}</small><b>${conquistado ? 'Desbloqueada ✓' : 'A conquistar'}</b></article>`)}</div></section>`;
}

Object.assign(actions, {
  'video.quadro': ({ valor }) => { quadro = valor; },
  'video.filtro': ({ valor }) => {
    filtro = valor;
  },

  'video.novo': () => {
    abrir('Novo vídeo', formVideo());
    return false;
  },

  'video.abrir': ({ id }) => {
    const v = state.videos.find((x) => x.id === id);
    if (v) abrir(v.titulo, formVideo(v));
    return false;
  },

  // A IA só preenche o formulário. Nada é salvo sem você revisar e apertar Salvar.
  'video.ia': async (_, botao) => {
    const form = botao.form;
    const relato = texto(form.relato.value);
    if (!relato) {
      aviso('Escreva o relato primeiro: a IA não inventa o que aconteceu.');
      form.relato.focus();
      return false;
    }
    botao.disabled = true;
    botao.textContent = 'Gerando roteiro…';
    try {
      const r = await gerarRoteiro(relato, QUADROS[form.quadro.value], perfilDaIA(state.settings));
      for (const k of ['gancho', 'roteiro', 'takes', 'legenda', 'cta']) if (r[k]) form[k].value = r[k];
      aviso('Roteiro gerado. Revise antes de salvar.');
    } catch (e) {
      aviso(e.message);
    }
    botao.disabled = false;
    botao.textContent = 'Gerar roteiro com IA';
    return false;
  },

  'video.salvar': (f) => {
    let v = state.videos.find((x) => x.id === f.id);
    if (!v) state.videos.push((v = { id: uid(), criadoEm: hoje() }));
    if (!dataRegistroVideo(v)) v.registradoEm = hoje();
    for (const k of ['titulo', 'quadro', 'status', 'previsto', 'relato', 'gancho', 'roteiro', 'takes', 'legenda', 'cta']) v[k] = texto(f[k]);
    v.pubs = {};
    for (const p of Object.keys(PLATAFORMAS)) {
      const pub = { data: f[`pub-${p}-data`], url: texto(f[`pub-${p}-url`]) };
      if (pub.data || pub.url) v.pubs[p] = pub;
    }
    // Com data de publicação, o vídeo está no ar: não faz sentido continuar "em edição".
    if (Object.values(v.pubs).some((p) => p.data) && !NO_AR.includes(v.status)) v.status = 'publicado';
    v.publicadoEm = NO_AR.includes(v.status) ? texto(f.publicadoEm) || dataPublicacao({ ...v, criadoEm: '' }) || hoje() : '';
    fechar();
    aviso(NO_AR.includes(v.status) ? 'Vídeo publicado e contabilizado na semana da publicação.' : 'Vídeo registrado. Ele aparece no contador de registrados; a meta acompanha os publicados.');
  },

  'video.excluir': ({ id }) => {
    if (!confirm('Excluir este vídeo e o roteiro dele?')) return false;
    state.videos = state.videos.filter((v) => v.id !== id);
    fechar();
  },
});
