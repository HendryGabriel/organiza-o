// Seletor e calendário próprios, no lugar do <select> e do <input type="date"> do navegador.
// O valor mora em um <input type="hidden"> com o mesmo `name` e o mesmo formato de antes (valor da opção;
// data como AAAA-MM-DD), então formulários e ações não precisaram mudar.
// Fechar no toque fora, Esc, botão voltar do Android e devolver o foco são da Popover API nativa.
// Aqui ficam o desenho, a posição e o teclado.
import { html, attr, icon, dataNumerica } from './ui.js';
import { hoje, iso, parseData, somaDias, diaSemana } from './logic.js';

const ESTREITO = '(max-width: 639px)'; // mesma medida do CSS: abaixo disso o painel vira folha inferior
let serie = 0;

const moldura = (id, rotulo, { oculto, dica }, miolo) => html`
  <div class="campo${oculto ? ' em-linha' : ''}">
    <span class="${oculto ? 'sr' : ''}" id="${id}-r">${rotulo}</span>
    <div class="wid">${miolo}</div>
    ${dica && html`<small>${dica}</small>`}
  </div>`;

// opcoes: { valor: 'Rótulo' }. Com `mudou`, a ação é chamada assim que a pessoa escolhe (filtros).
// Com `vazio`, o campo pode começar sem escolha, mostrando esse texto; sem ele, começa na primeira opção.
export function seletor(rotulo, nome, opcoes, atual, extra = {}) {
  const id = `w${++serie}`;
  const valor = String(atual) in opcoes ? String(atual) : extra.vazio ? '' : Object.keys(opcoes)[0];
  return moldura(id, rotulo, extra, html`
    <input type="hidden" name="${nome}" value="${valor}" ${extra.mudou && html`data-mudou="${extra.mudou}"`}>
    <button type="button" class="gatilho" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-l" aria-labelledby="${id}-r ${id}-v">
      <span id="${id}-v" class="${valor ? '' : 'vago'}">${valor ? opcoes[valor] : extra.vazio}</span>${icon('caret-down', 18)}
    </button>
    <div class="pop" popover>
      <p class="pop-titulo" aria-hidden="true">${rotulo}</p>
      <div class="lista" id="${id}-l" role="listbox" aria-labelledby="${id}-r">
        ${Object.entries(opcoes).map(([v, r]) => html`
          <button type="button" role="option" data-valor="${v}" aria-selected="${String(v === valor)}">${r}${icon('check', 18)}</button>`)}
      </div>
    </div>`);
}

// Data opcional ganha o botão "Limpar"; com `obrigatorio`, sempre há uma data escolhida.
export function calendario(rotulo, nome, valor, extra = {}) {
  const id = `w${++serie}`;
  const { min, max, obrigatorio, mudou } = extra;
  return moldura(id, rotulo, extra, html`
    <input type="hidden" name="${nome}" value="${valor || ''}" data-min="${min || ''}" data-max="${max || ''}" ${attr('data-obrigatorio', obrigatorio)} ${mudou && html`data-mudou="${mudou}"`}>
    <button type="button" class="gatilho" aria-haspopup="dialog" aria-expanded="false" aria-labelledby="${id}-r ${id}-v">
      <span id="${id}-v" class="${valor ? '' : 'vago'}">${valor ? dataNumerica(valor) : 'Escolher data'}</span>${icon('calendar-blank', 18)}
    </button>
    <div class="pop cal" popover role="dialog" aria-labelledby="${id}-r"></div>`);
}

// ---------- Comportamento (um conjunto de ouvintes para todos os seletores e calendários da página) ----------

const popDe = (gatilho) => gatilho.parentElement.querySelector('.pop');
const gatilhoDe = (pop) => pop.parentElement.querySelector('.gatilho');
const campoDe = (pop) => pop.parentElement.querySelector('input[type=hidden]');
const foraDoLimite = (data, { min, max }) => Boolean((min && data < min) || (max && data > max));

const MES = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const DIA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Desenha o mês de `foco`. É `foco` que recebe o teclado quando o calendário abre ou muda de mês.
function desenhar(pop, foco) {
  const campo = campoDe(pop);
  const d = parseData(foco);
  const primeiro = iso(new Date(d.getFullYear(), d.getMonth(), 1, 12));
  const dias = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  pop.dataset.mes = primeiro;
  pop.innerHTML = html`
    <div class="cal-topo">
      <button type="button" class="ic-btn" data-mes="-1" aria-label="Mês anterior">${icon('caret-left')}</button>
      <b aria-live="polite">${MES.format(d)}</b>
      <button type="button" class="ic-btn" data-mes="1" aria-label="Próximo mês">${icon('caret-right')}</button>
    </div>
    <div class="cal-grade">
      ${SEMANA.map((s) => html`<span aria-hidden="true">${s}</span>`)}
      ${[...Array(diaSemana(primeiro))].map(() => html`<i></i>`)}
      ${[...Array(dias)].map((_, i) => {
        const dia = somaDias(primeiro, i);
        return html`<button type="button" data-dia="${dia}" aria-label="${DIA.format(parseData(dia))}" aria-pressed="${String(dia === campo.value)}" tabindex="${dia === foco ? 0 : -1}" ${attr('aria-current="date"', dia === hoje())} ${attr('disabled', foraDoLimite(dia, campo.dataset))}>${i + 1}</button>`;
      })}
    </div>
    <div class="cal-base">
      <button type="button" class="btn btn-t" data-dia="${hoje()}" ${attr('disabled', foraDoLimite(hoje(), campo.dataset))}>Hoje</button>
      ${!campo.hasAttribute('data-obrigatorio') && html`<button type="button" class="btn btn-t" data-dia="">Limpar</button>`}
    </div>`.__raw;
}

// No computador o painel abre colado ao campo: embaixo, ou em cima quando não cabe. No celular o CSS manda.
const lugar = (gatilho) => {
  const g = gatilho.getBoundingClientRect();
  return `${Math.round(g.top)},${Math.round(g.left)}`;
};

function posicionar(pop, gatilho) {
  if (matchMedia(ESTREITO).matches) return pop.removeAttribute('style');
  const g = gatilho.getBoundingClientRect();
  pop.dataset.lugar = lugar(gatilho); // para saber depois se o campo saiu do lugar
  pop.style.minWidth = `${g.width}px`;
  pop.style.maxHeight = '';
  let { width, height } = pop.getBoundingClientRect();
  const [folga, borda] = [6, 8];
  const embaixo = innerHeight - g.bottom - folga - borda;
  const emCima = g.top - folga - borda;
  const sobe = height > embaixo && emCima > embaixo;
  const espaco = sobe ? emCima : embaixo;
  // Lista maior que o espaço: encolhe e rola por dentro, sem cobrir o campo. O calendário não encolhe.
  if (height > espaco && espaco >= 180 && !pop.matches('.cal')) {
    pop.style.maxHeight = `${espaco}px`;
    height = espaco;
  }
  const topo = sobe ? g.top - folga - height : g.bottom + folga;
  pop.style.top = `${Math.max(borda, Math.min(topo, innerHeight - height - borda))}px`;
  pop.style.left = `${Math.max(borda, Math.min(g.left, innerWidth - width - borda))}px`;
}

function abrir(gatilho) {
  const pop = popDe(gatilho);
  if (pop.matches('.cal')) {
    const campo = campoDe(pop);
    const { min, max } = campo.dataset;
    desenhar(pop, campo.value || (min && hoje() < min ? min : max && hoje() > max ? max : hoje()));
  }
  gatilho.focus({ preventScroll: true }); // é para cá que o foco volta quando o painel fechar
  pop.showPopover();
  posicionar(pop, gatilho);
  gatilho.setAttribute('aria-expanded', 'true');
  const foco = pop.querySelector('[aria-selected="true"], .cal-grade [tabindex="0"]:not(:disabled)') || pop.querySelector('.lista button, .cal-grade button:not(:disabled)');
  foco?.focus({ preventScroll: true });
  foco?.scrollIntoView({ block: 'nearest' });
}

function escolher(pop, valor, rotulo) {
  const campo = campoDe(pop);
  const texto = gatilhoDe(pop).firstElementChild;
  texto.textContent = rotulo;
  texto.classList.toggle('vago', valor === '');
  pop.hidePopover();
  gatilhoDe(pop).setAttribute('aria-expanded', 'false');
  if (campo.value === valor) return;
  campo.value = valor;
  campo.dispatchEvent(new Event('change', { bubbles: true })); // o app ouve `change` como em qualquer campo
}

function aoClicar(e) {
  const gatilho = e.target.closest('.gatilho');
  if (gatilho) {
    // Tocar no campo com o painel aberto fecha (o navegador já fechou pelo toque fora); não reabre.
    if (gatilho.dataset.aberto === 'true') popDe(gatilho).matches(':popover-open') && popDe(gatilho).hidePopover();
    else abrir(gatilho);
    gatilho.dataset.aberto = 'false';
    return;
  }
  const pop = e.target.closest('.pop');
  if (!pop) return;
  const opcao = e.target.closest('[data-valor]');
  const dia = e.target.closest('[data-dia]');
  const mes = e.target.closest('[data-mes]');
  if (opcao) {
    for (const o of pop.querySelectorAll('[role=option]')) o.setAttribute('aria-selected', String(o === opcao));
    escolher(pop, opcao.dataset.valor, opcao.textContent.trim());
  } else if (dia) {
    escolher(pop, dia.dataset.dia, dia.dataset.dia ? dataNumerica(dia.dataset.dia) : 'Escolher data');
  } else if (mes) {
    const d = parseData(pop.dataset.mes);
    d.setMonth(d.getMonth() + Number(mes.dataset.mes));
    desenhar(pop, iso(d));
    pop.querySelector(`[data-mes="${mes.dataset.mes}"]`).focus();
  }
}

function aoTeclar(e) {
  const gatilho = e.target.closest?.('.gatilho');
  if (gatilho && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    return abrir(gatilho);
  }
  const pop = e.target.closest?.('.pop');
  if (!pop) return;

  if (pop.matches('.cal')) {
    const atual = e.target.closest('.cal-grade button')?.dataset.dia;
    if (!atual) return;
    const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let novo;
    if (passo) novo = somaDias(atual, passo);
    else if (e.key === 'PageUp' || e.key === 'PageDown') {
      const d = parseData(atual);
      d.setMonth(d.getMonth() + (e.key === 'PageUp' ? -1 : 1));
      novo = iso(d);
    } else return;
    e.preventDefault();
    if (foraDoLimite(novo, campoDe(pop).dataset)) return;
    if (novo.slice(0, 7) !== pop.dataset.mes.slice(0, 7)) desenhar(pop, novo);
    pop.querySelector(`.cal-grade [data-dia="${novo}"]`).focus();
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault(); // na lista, Tab fecha e devolve o foco ao campo, como em um seletor comum
    return pop.hidePopover();
  }
  const opcoes = [...pop.querySelectorAll('[role=option]')];
  const i = opcoes.indexOf(document.activeElement);
  const inicial = e.key.length === 1 && e.key.trim() && e.key.toLowerCase();
  const alvo =
    { ArrowDown: opcoes[i + 1], ArrowUp: opcoes[i - 1], Home: opcoes[0], End: opcoes.at(-1) }[e.key] ||
    // digitar uma letra pula para a próxima opção que começa com ela
    (inicial && [...opcoes.slice(i + 1), ...opcoes.slice(0, i + 1)].find((o) => o.textContent.trim().toLowerCase().startsWith(inicial)));
  if (!alvo) return;
  e.preventDefault();
  alvo.focus();
}


export function iniciar() {
  document.addEventListener('click', aoClicar);
  document.addEventListener('keydown', aoTeclar);
  // Antes do clique: guarda se o painel estava aberto, porque o toque fora fecha antes de o clique chegar.
  document.addEventListener('pointerdown', (e) => {
    const gatilho = e.target.closest?.('.gatilho');
    if (gatilho) gatilho.dataset.aberto = String(popDe(gatilho).matches(':popover-open'));
  }, true);
  // `toggle` não borbulha, por isso a captura.
  document.addEventListener('toggle', (e) => {
    if (e.target.matches?.('.pop') && e.newState === 'closed') gatilhoDe(e.target)?.setAttribute('aria-expanded', 'false');
  }, true);
  // No computador o painel fica colado ao campo. Se a tela mudar de tamanho, ele se reposiciona; se o campo
  // rolar para outro lugar, fecha em vez de ficar solto. Compara a posição em vez de reagir a qualquer rolagem:
  // o aviso de uma rolagem que terminou antes do toque chega depois de o painel abrir.
  const aberto = () => document.querySelector('.pop:popover-open');
  addEventListener('resize', () => aberto() && posicionar(aberto(), gatilhoDe(aberto())));
  document.addEventListener('scroll', (e) => {
    const pop = aberto();
    if (!pop || e.target.closest?.('.pop') || matchMedia(ESTREITO).matches) return;
    if (pop.dataset.lugar !== lugar(gatilhoDe(pop))) pop.hidePopover();
  }, true);
  // Sair do calendário com Tab fecha o painel.
  document.addEventListener('focusout', (e) => {
    const pop = e.target.closest?.('.pop');
    if (pop && e.relatedTarget && !pop.contains(e.relatedTarget)) pop.matches(':popover-open') && pop.hidePopover();
  });
}
