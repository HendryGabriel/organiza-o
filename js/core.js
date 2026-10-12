// Estado, persistência e as peças compartilhadas pelas telas (ações, diálogo, aviso).
import { seed } from './seed.js';
import { hoje } from './logic.js';
import { html, icon } from './ui.js';

const CHAVE = 'hendry.v1';

function hidratar(salvo) {
  const base = seed();
  return { ...base, ...salvo, settings: { ...base.settings, ...salvo.settings } };
}

function carregar() {
  const bruto = localStorage.getItem(CHAVE);
  if (!bruto) return seed();
  try {
    return hidratar(JSON.parse(bruto));
  } catch {
    // Dado ilegível não é sobrescrito: fica guardado para recuperação manual.
    localStorage.setItem(`${CHAVE}.corrompido`, bruto);
    return seed();
  }
}

export let state = carregar();

// ponytail: localStorage (uns 5 MB) guarda tudo em um JSON. Trocar por IndexedDB quando entrar foto ou áudio.
export function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(state));
  } catch {
    aviso('Sem espaço para salvar. Exporte um backup em Configurações.');
  }
}

let render = () => {};
export const aoRenderizar = (fn) => {
  render = fn;
};
export const commit = () => {
  salvar();
  render();
};

// Backup importado é entrada externa: só entra se tiver a cara do estado deste app.
export function substituir(obj) {
  const listas = ['feitos', 'tasks', 'leads', 'videos', 'financas', 'treinos', 'refeicoes', 'medidas'];
  if (obj?.v !== 1 || !listas.every((k) => Array.isArray(obj[k]))) return false;
  state = hidratar(obj);
  commit();
  return true;
}

export function apagarTudo() {
  state = seed();
  commit();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const texto = (v) => String(v ?? '').trim();

// Tudo que conta como ação concluída passa por aqui; a semana é contada a partir desta lista.
export function registrarFeito({ chave, titulo, area, min }) {
  state.feitos.push({ data: hoje(), chave, titulo, area, min: min || 0 });
}

// Convite de instalação que o Chrome entrega (Android e computador). No iPhone não existe: é pelo menu Compartilhar.
export const pwa = { convite: null };

// ---------- Ações ----------
// As telas registram funções aqui; app.js chama pelo nome que vem em data-act / data-mudou.
export const actions = {};

// ---------- Diálogo e aviso ----------
const dlg = () => document.getElementById('dlg');

export function abrir(titulo, corpo) {
  dlg().innerHTML = html`
    <header class="dlg-topo">
      <h2 id="dlg-titulo">${titulo}</h2>
      <button type="button" class="ic-btn" data-act="fechar" aria-label="Fechar">${icon('x', 22)}</button>
    </header>
    ${corpo}`.__raw;
  if (!dlg().open) dlg().showModal();
}
export const fechar = () => dlg().close();
export const dialogoAberto = () => dlg().open;
actions.fechar = () => {
  fechar();
  return false;
};

// O aviso é um popover para ficar acima do diálogo modal (erro do Gemini aparece com o formulário aberto).
let relogio;
export function aviso(msg) {
  const el = document.getElementById('toast');
  if (el.matches(':popover-open')) el.hidePopover();
  el.showPopover();
  el.textContent = msg;
  clearTimeout(relogio);
  relogio = setTimeout(() => el.hidePopover(), 4000);
}

// Erro de formulário: balão nativo no próprio campo, com foco nele. Some quando a pessoa volta a digitar.
export function invalido(campo, msg) {
  campo.setCustomValidity(msg);
  campo.reportValidity();
  campo.addEventListener('input', () => campo.setCustomValidity(''), { once: true });
  return false;
}

export function baixar(nome, conteudo) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([conteudo], { type: 'application/json' })),
    download: nome,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}
