import { state, actions, abrir, fechar, aviso, uid, texto } from '../core.js';
import { html, attr, icon, topo, campo, opcoes, vazio, dataMedia } from '../ui.js';
import { hoje, resumoSemana } from '../logic.js';
import { gerarRoteiro } from '../gemini.js';

const STATUS = {
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

let filtro = 'producao';

function formVideo(v) {
  const novo = !v;
  v ||= { quadro: 'lancer', status: 'ideia', pubs: {} };
  return html`
    <form class="dlg-corpo" data-act="video.salvar" data-id="${v.id || ''}">
      ${campo('Título ou tema', html`<input name="titulo" required value="${v.titulo || ''}" autocomplete="off">`)}
      <div class="dupla">
        ${campo('Quadro', html`<select name="quadro">${opcoes(QUADROS, v.quadro)}</select>`)}
        ${campo('Etapa', html`<select name="status">${opcoes(STATUS, v.status)}</select>`)}
      </div>
      ${campo('Data prevista', html`<input type="date" name="previsto" value="${v.previsto || ''}">`)}

      ${campo('Relato', html`<textarea name="relato" rows="4" placeholder="Ex.: testei a demo com um escritório fictício e o agendamento falhou…">${v.relato || ''}</textarea>`, 'O que aconteceu de verdade. O roteiro sai daqui e de mais nada.')}
      <button type="button" class="btn btn-s" data-act="video.ia">Gerar roteiro com IA</button>

      ${campo('Gancho', html`<input name="gancho" value="${v.gancho || ''}" autocomplete="off">`)}
      ${campo('Roteiro narrado', html`<textarea name="roteiro" rows="7">${v.roteiro || ''}</textarea>`, '0 a 5 s gancho, 5 a 15 s contexto, 15 a 45 s ação, 45 a 60 s resultado.')}
      ${campo('Takes', html`<textarea name="takes" rows="4" placeholder="Um take por linha…">${v.takes || ''}</textarea>`, 'Só em casa ou na academia. Nunca o ambiente ou as telas do emprego.')}
      ${campo('Legenda', html`<textarea name="legenda" rows="2">${v.legenda || ''}</textarea>`)}
      ${campo('CTA', html`<input name="cta" value="${v.cta || ''}" autocomplete="off">`)}

      <fieldset class="grupo">
        <legend>Publicações</legend>
        ${Object.entries(PLATAFORMAS).map(([p, nome]) => html`
          <div class="dupla">
            ${campo(nome, html`<input type="date" name="pub-${p}-data" value="${v.pubs[p]?.data || ''}">`)}
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
  const noAr = state.videos.filter((v) => Object.values(v.pubs || {}).some((p) => p.data));
  const posts = noAr.reduce((t, v) => t + Object.values(v.pubs).filter((p) => p.data).length, 0);
  const visiveis = state.videos
    .filter((v) => (filtro === 'todos' ? true : filtro === 'producao' ? !NO_AR.includes(v.status) : v.status === filtro))
    .sort((a, b) => (a.previsto || '9').localeCompare(b.previsto || '9'));

  return html`
    ${topo('Conteúdo', 'Primeiro acontece, depois vira vídeo')}

    <dl class="stats">
      <div><dt>vídeos nesta semana</dt><dd class="num">${s.videos}<small>/${state.settings.videosSemana}</small></dd></div>
      <div><dt>vídeos no ar</dt><dd class="num">${noAr.length}</dd></div>
      <div><dt>posts no total</dt><dd class="num">${posts}</dd></div>
    </dl>

    <div class="barra">
      <label class="campo em-linha">
        <span class="sr">Filtrar por etapa</span>
        <select data-mudou="video.filtro">
          <option value="producao" ${attr('selected', filtro === 'producao')}>Em produção</option>
          <option value="todos" ${attr('selected', filtro === 'todos')}>Todos</option>
          ${opcoes(STATUS, filtro)}
        </select>
      </label>
      <button class="btn btn-p" data-act="video.novo">${icon('plus')} Novo vídeo</button>
    </div>

    ${visiveis.length === 0
      ? vazio('Nenhum vídeo nessa etapa.')
      : html`
        <ul class="linhas">
          ${visiveis.map((v) => html`
            <li>
              <button class="linha" data-act="video.abrir" data-id="${v.id}">
                <span class="principal">${v.titulo}</span>
                <span class="lado">${v.previsto ? dataMedia(v.previsto) : ''}</span>
                <span class="detalhe">${QUADROS[v.quadro]} · ${STATUS[v.status]}</span>
              </button>
            </li>`)}
        </ul>`}`;
}

Object.assign(actions, {
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
      const r = await gerarRoteiro(relato, QUADROS[form.quadro.value]);
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
    for (const k of ['titulo', 'quadro', 'status', 'previsto', 'relato', 'gancho', 'roteiro', 'takes', 'legenda', 'cta']) v[k] = texto(f[k]);
    v.pubs = {};
    for (const p of Object.keys(PLATAFORMAS)) {
      const pub = { data: f[`pub-${p}-data`], url: texto(f[`pub-${p}-url`]) };
      if (pub.data || pub.url) v.pubs[p] = pub;
    }
    // Com data de publicação, o vídeo está no ar: não faz sentido continuar "em edição".
    if (Object.values(v.pubs).some((p) => p.data) && !NO_AR.includes(v.status)) v.status = 'publicado';
    fechar();
  },

  'video.excluir': ({ id }) => {
    if (!confirm('Excluir este vídeo e o roteiro dele?')) return false;
    state.videos = state.videos.filter((v) => v.id !== id);
    fechar();
  },
});
