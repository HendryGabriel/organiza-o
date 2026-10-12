// Shell: navegação por hash, despacho de ações e registro do service worker.
import { actions, aoRenderizar, commit, pwa } from './core.js';
import { html, attr, icon, duracao } from './ui.js';
import { hoje } from './logic.js';
import { render as telaHoje } from './views/hoje.js';
import { render as negocio } from './views/negocio.js';
import { render as conteudo } from './views/conteudo.js';
import { render as corpo } from './views/corpo.js';
import { render as lancer } from './views/lancer.js';
import { menu, semana, tarefas, rotina, config } from './views/mais.js';
import { iniciar as iniciarSincronizacao } from './sinc.js';

const rotas = { hoje: telaHoje, negocio, conteudo, corpo, lancer, mais: menu, semana, tarefas, rotina, config };

const PRINCIPAL = [
  ['hoje', 'Hoje', 'lightning'],
  ['negocio', 'Negócio', 'handshake'],
  ['conteudo', 'Conteúdo', 'film-slate'],
  ['corpo', 'Corpo', 'barbell'],
  ['lancer', 'Lancer', 'gauge'],
];
const APOIO = [
  ['semana', 'Semana', 'chart-bar'],
  ['tarefas', 'Tarefas', 'list-checks'],
  ['rotina', 'Rotina', 'calendar-check'],
  ['config', 'Configurações', 'gear-six'],
];
const link = (apoio) => ([rota, nome, ic]) =>
  html`<a href="#/${rota}" data-rota="${rota}" ${attr('class="apoio"', apoio)}>${icon(ic, 22)}<span>${nome}</span></a>`;

document.getElementById('nav').innerHTML = html`
  <a class="marca" href="#/hoje" translate="no">hendry<b>.ia</b></a>
  ${PRINCIPAL.map(link(false))}${APOIO.map(link(true))}`.__raw;

const main = document.getElementById('main');
let diaRenderizado;

function render() {
  const [nome, sub] = location.hash.replace(/^#\/?/, '').split('/');
  const rota = rotas[nome] ? nome : 'hoje';
  main.innerHTML = rotas[rota](sub).__raw;
  for (const a of document.querySelectorAll('#nav a[data-rota]')) {
    if (a.dataset.rota === rota) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  diaRenderizado = hoje();
}
aoRenderizar(render);

addEventListener('hashchange', () => {
  render();
  scrollTo(0, 0);
  main.focus({ preventScroll: true });
});
// App aberto de um dia para o outro: ao voltar, mostra o dia certo.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && diaRenderizado !== hoje()) render();
});

// ---------- Ações ----------
// data-act em botão ou formulário, data-mudou em campo. A ação devolve false quando não mudou o estado.
async function executar(nome, dados, el) {
  const acao = actions[nome];
  if (!acao) return console.warn('Ação desconhecida:', nome);
  if ((await acao(dados, el)) !== false) commit();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && el.tagName !== 'FORM') executar(el.dataset.act, { ...el.dataset }, el);
});
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (!form.dataset.act) return;
  e.preventDefault();
  executar(form.dataset.act, { ...form.dataset, ...Object.fromEntries(new FormData(form, e.submitter)) }, form);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-mudou]');
  if (el) executar(el.dataset.mudou, { ...el.dataset, valor: el.value }, el);
});

// Cronômetro opcional da tela Hoje.
setInterval(() => {
  const el = document.getElementById('timer');
  if (el) el.textContent = duracao(Date.now() - Number(el.dataset.inicio));
}, 1000);

render();

// Guarda o convite de instalação para o botão em Configurações.
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pwa.convite = e;
  if (location.hash.startsWith('#/config')) render();
});
addEventListener('appinstalled', () => {
  pwa.convite = null;
  if (location.hash.startsWith('#/config')) render();
});

iniciarSincronizacao();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
// Pede ao navegador para não apagar os dados quando faltar espaço.
navigator.storage?.persist?.();
