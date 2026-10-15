import { ICONS } from './icons.js?v=7';
import { parseData } from './logic.js?v=7';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESCAPES[c]);
export const raw = (s) => ({ __raw: String(s) });
const paraHtml = (v) =>
  v == null || v === false || v === true ? '' : Array.isArray(v) ? v.map(paraHtml).join('') : v.__raw ?? esc(v);

// Template com escape automático: tudo que é interpolado vira texto, a não ser que venha de html`` ou raw().
// Texto digitado, backup importado e resposta do Gemini passam por aqui antes de chegar ao DOM.
export const html = (partes, ...vals) =>
  raw(partes.reduce((out, p, i) => out + p + (i < vals.length ? paraHtml(vals[i]) : ''), ''));

export const attr = (nome, ligado) => (ligado ? raw(nome) : '');

export const icon = (nome, tamanho = 20) =>
  raw(`<svg class="ic" width="${tamanho}" height="${tamanho}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${ICONS[nome]}</svg>`);

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCurta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat('pt-BR');
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
export const dinheiro = (cent) => moeda.format((cent || 0) / 100);
export const dinheiroCurto = (cent) => moedaCurta.format((cent || 0) / 100);
export const n = (v) => numero.format(v ?? 0);
const curto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
export const compacto = (v) => curto.format(v ?? 0);
// Valor em centavos no formato que a pessoa digita: 8500000 -> "85.000,00"
export const valorCampo = (cent) => (cent ? (cent / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
export const pct = (fracao) => porcento.format(fracao);

const data = (opcoes) => {
  const f = new Intl.DateTimeFormat('pt-BR', opcoes);
  return (isoData) => f.format(parseData(isoData));
};
export const dataCurta = data({ day: '2-digit', month: '2-digit' });
export const dataNumerica = data({ day: '2-digit', month: '2-digit', year: 'numeric' });
export const dataMedia = data({ weekday: 'short', day: '2-digit', month: '2-digit' });
export const dataLonga = data({ weekday: 'long', day: 'numeric', month: 'long' });

export const duracao = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const topo = (titulo, sub) => html`
  <header class="topo">
    <div><h1>${titulo}</h1>${sub && html`<p>${sub}</p>`}</div>
    <a class="ic-btn so-mobile" href="#/mais" aria-label="Mais opções">${icon('list', 22)}</a>
  </header>`;

export const campo = (rotulo, controle, dica) => html`
  <label class="campo"><span>${rotulo}</span>${controle}${dica && html`<small>${dica}</small>`}</label>`;

// Título de um bloco que abre e fecha, com a seta do próprio app no lugar do triângulo do navegador.
export const resumo = (texto) => html`<summary>${icon('caret-right', 16)}<span>${texto}</span></summary>`;

export const vazio = (texto, acao) => html`<div class="vazio"><p>${texto}</p>${acao}</div>`;
