// Estado, persistência e as peças compartilhadas pelas telas (ações, diálogo, aviso).
import { seed } from './seed.js?v=7';
import { hoje } from './logic.js?v=7';
import { MAPAS, retrato, carimbar, darIds, valido } from './mescla.js?v=7';
import { html, icon } from './ui.js?v=7';

const CHAVE = 'hendry.v1';

function hidratar(salvo) {
  const base = seed();
  const estado = { ...base, ...salvo, settings: { ...base.settings, ...salvo.settings } };
  for (const m of MAPAS) estado[m] ||= base[m];
  estado.apagados ||= {};
  darIds(estado, Date.now());
  return estado;
}

let legado = false; // dados salvos antes de existir sincronização

function carregar() {
  const bruto = localStorage.getItem(CHAVE);
  if (!bruto) return seed();
  try {
    const salvo = JSON.parse(bruto);
    legado = !salvo.apagados;
    return hidratar(salvo);
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

// Retrato do último salvamento. É contra ele que cada salvamento descobre o que mudou, para a sincronização
// saber o que é mais novo em cada aparelho sem as telas precisarem avisar.
let anterior = retrato(legado ? seed() : state);
if (legado) {
  // Primeira carga depois da atualização: tudo que difere do plano original conta como mexido agora.
  anterior = carimbar(state, anterior, Date.now()).retrato;
  salvar();
}

let render = () => {};
export const aoRenderizar = (fn) => {
  render = fn;
};

const ouvintes = [];
// Avisa depois de cada salvamento que mudou algo sincronizável.
export const aoMudar = (fn) => ouvintes.push(fn);

export const commit = () => {
  const { retrato: novo, mudou } = carimbar(state, anterior, Date.now());
  anterior = novo;
  salvar();
  render();
  if (mudou) for (const fn of ouvintes) fn();
};

// Quem está no meio de um formulário da tela não perde o que digitou: ela se atualiza na próxima ação.
const preenchendo = () => Boolean(document.activeElement?.closest?.('#main form'));

// Estado que chegou da nuvem, já juntado com o deste aparelho. Não é mudança local: não carimba nem reenvia.
export function aplicarRemoto(novo) {
  state = novo;
  anterior = retrato(state);
  salvar();
  if (!preenchendo()) render();
}

// Outra aba ou janela deste app salvou: adota o estado dela, para uma não desfazer o trabalho da outra.
addEventListener('storage', (e) => {
  if (e.key !== CHAVE || !e.newValue) return;
  try {
    state = hidratar(JSON.parse(e.newValue));
    anterior = retrato(state);
    if (!preenchendo()) render();
  } catch {
    // valor ilegível de outra aba: fica com o que já está na memória
  }
});

// Backup importado é entrada externa: só entra se tiver a cara do estado deste app.
// Não conta como "mexi em tudo agora": com a sincronização ligada, o backup é juntado ao que está na nuvem.
export function substituir(obj) {
  if (!valido(obj)) return false;
  state = hidratar(obj);
  anterior = retrato(state);
  salvar();
  render();
  for (const fn of ouvintes) fn();
  return true;
}

export function apagarTudo() {
  state = seed();
  anterior = retrato(state);
  salvar();
  render();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const texto = (v) => String(v ?? '').trim();

// Tudo que conta como ação concluída passa por aqui; a semana é contada a partir desta lista.
// `data` só vem do relato do dia ("ontem eu..."). Devolve o id para quem precisar desfazer.
export function registrarFeito({ chave, titulo, area, min, data }) {
  const id = uid();
  state.feitos.push({ id, data: data || hoje(), chave, titulo, area, min: min || 0 });
  return id;
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
// Com `desfazer`, ganha um botão que reverte o que acabou de ser gravado, e fica mais tempo na tela.
let relogio;
export function aviso(msg, desfazer) {
  const el = document.getElementById('toast');
  if (el.matches(':popover-open')) el.hidePopover();
  el.showPopover();
  el.textContent = msg;
  if (desfazer) {
    const botao = Object.assign(document.createElement('button'), { type: 'button', className: 'toast-acao', textContent: 'Desfazer' });
    botao.onclick = () => {
      desfazer();
      commit();
      aviso('Desfeito.');
    };
    el.append(botao);
  }
  clearTimeout(relogio);
  relogio = setTimeout(() => el.hidePopover(), desfazer ? 8000 : 4000);
}

// Erro de formulário: escrito embaixo do próprio campo, com o foco nele. Some quando a pessoa corrige.
export function invalido(campo, msg) {
  const caixa = campo.closest('.campo');
  const erro = caixa.querySelector('.erro-campo') || caixa.appendChild(Object.assign(document.createElement('small'), { className: 'erro erro-campo', role: 'alert' }));
  erro.textContent = msg;
  (campo.type === 'hidden' ? caixa.querySelector('.gatilho') : campo).focus();
  const limpar = () => erro.remove();
  caixa.addEventListener('input', limpar, { once: true });
  caixa.addEventListener('change', limpar, { once: true });
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
