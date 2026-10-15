import { hoje, somaDias, inicioSemana, iso, parseData } from './logic.js?v=6';
import { html, icon, attr, dataNumerica } from './ui.js?v=6';

export const ATALHOS = { hoje: 'Hoje', ontem: 'Ontem', dois: 'Hoje e ontem', 7: 'Últimos 7 dias', 14: 'Últimos 14 dias', 28: 'Últimos 28 dias', 30: 'Últimos 30 dias', semana: 'Esta semana', passada: 'Semana passada', mes: 'Este mês', mesPassado: 'Mês passado' };
export function periodoPronto(chave, ref = hoje()) {
  const d = parseData(ref), iniMes = iso(new Date(d.getFullYear(), d.getMonth(), 1, 12));
  if (chave === 'hoje') return [ref, ref];
  if (chave === 'ontem') return [somaDias(ref, -1), somaDias(ref, -1)];
  if (chave === 'dois') return [somaDias(ref, -1), ref];
  if (chave === 'semana') return [inicioSemana(ref), ref];
  if (chave === 'passada') return [somaDias(inicioSemana(ref), -7), somaDias(inicioSemana(ref), -1)];
  if (chave === 'mes') return [iniMes, ref];
  if (chave === 'mesPassado') return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1, 12)), somaDias(iniMes, -1)];
  return [somaDias(ref, -(Number(chave) || 30) + 1), ref];
}
export function lerPeriodo(valor, padrao = '30') {
  const [ini, fim] = String(valor || '').split('|');
  const valida = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && iso(parseData(v)) === v;
  return valida(ini) && valida(fim) && ini <= fim ? [ini, fim] : periodoPronto(padrao);
}
let sequencia = 0;
const recentes = () => { try { return JSON.parse(localStorage.getItem('hendry.periodos-recentes') || '[]').slice(0, 3); } catch { return []; } };
const mesInicial = (ini, fim) => { const d = parseData(`${ini.slice(0, 7)}-01`); if (ini.slice(0, 7) === fim.slice(0, 7)) d.setMonth(d.getMonth() - 1); return iso(d); };
const mesNome = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const diaNome = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
export function filtroPeriodo(rotulo, valor, mudou, padrao = '30', textoGatilho = '', comparacao = false) {
  const [ini, fim] = lerPeriodo(valor, padrao), id = `periodo-${++sequencia}`;
  return html`<div class="filtro-periodo" data-comparacao="${String(comparacao)}"><input type="hidden" name="periodo" value="${ini}|${fim}${comparacao ? `|${String(valor || '').split('|')[2] || '1'}` : ''}" data-mudou="${mudou}"><button class="gatilho-periodo" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="${id}">${icon('calendar-blank')}<span>${textoGatilho || `${rotulo}: ${dataNumerica(ini)} a ${dataNumerica(fim)}`}</span>${icon('caret-down', 16)}</button><div id="${id}" class="periodo-pop" popover role="dialog" aria-label="Selecionar período"></div></div>`;
}
function desenhar(pop) {
  const base = parseData(pop.dataset.mes), ini = pop.dataset.ini, fim = pop.dataset.fim;
  const meses = [0, 1].map((i) => {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1, 12), inicio = iso(d), dias = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const deslocamento = (d.getDay() + 6) % 7;
    return html`<section class="periodo-mes"><h3>${mesNome.format(d)}</h3><div class="periodo-grade">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((s) => html`<span>${s}</span>`)}${Array.from({ length: deslocamento }, () => html`<i></i>`)}${Array.from({ length: dias }, (_, j) => { const dia = somaDias(inicio, j); return html`<button type="button" data-periodo-dia="${dia}" aria-label="${diaNome.format(parseData(dia))}" aria-pressed="${String(dia >= ini && dia <= fim)}" class="${dia === ini || dia === fim ? 'ponta' : dia >= ini && dia <= fim ? 'entre' : ''}" ${attr('disabled', dia > hoje())}>${j + 1}</button>`; })}</div></section>`;
  });
  pop.innerHTML = html`<div class="periodo-painel"><aside>${recentes().length > 0 && html`<h3>Usados recentemente</h3>${recentes().map((valor) => { const [a, b] = lerPeriodo(valor); return html`<button type="button" data-periodo-recente="${valor}"><i></i>${dataNumerica(a)} a ${dataNumerica(b)}</button>`; })}`}<h3>Períodos rápidos</h3>${['hoje', 'ontem', 'dois', '7', '14', '28', '30', 'semana', 'passada', 'mes', 'mesPassado'].map((chave) => [chave, ATALHOS[chave]]).map(([chave, nome]) => { const intervalo = periodoPronto(chave); return html`<button type="button" data-periodo-atalho="${chave}" class="${intervalo[0] === ini && intervalo[1] === fim ? 'escolhido' : ''}"><i></i>${nome}</button>`; })}</aside><div class="periodo-conteudo"><div class="periodo-navegacao"><button class="ic-btn" type="button" data-periodo-mes="-1" aria-label="Meses anteriores">${icon('caret-left')}</button><span>Selecione o início e depois o fim</span><button class="ic-btn" type="button" data-periodo-mes="1" aria-label="Próximos meses">${icon('caret-right')}</button></div><div class="periodo-meses">${meses}</div><div class="dupla"><label class="campo">Data inicial<input type="date" data-periodo-inicio value="${ini}" max="${hoje()}"></label><label class="campo">Data final<input type="date" data-periodo-fim value="${fim}" max="${hoje()}"></label></div>${pop.dataset.comparacao === 'true' && html`<label class="marcar"><input type="checkbox" data-periodo-comparar ${attr('checked', pop.dataset.comparar !== '0')}>Comparar com o período anterior</label>`}<p class="periodo-erro" role="alert"></p><footer><small>Horário de São Paulo</small><button type="button" class="btn btn-s" data-periodo-cancelar>Cancelar</button><button type="button" class="btn btn-p" data-periodo-aplicar>Atualizar</button></footer></div></div>`.__raw;
}
export function iniciarPeriodos() {
  document.addEventListener('click', (e) => {
    const gatilho = e.target.closest('.gatilho-periodo');
    if (gatilho) {
      const pop = gatilho.parentElement.querySelector('.periodo-pop'), [ini, fim] = lerPeriodo(gatilho.parentElement.querySelector('input').value);
      Object.assign(pop.dataset, { ini, fim, mes: mesInicial(ini, fim), selecionando: 'inicio', comparacao: gatilho.parentElement.dataset.comparacao, comparar: gatilho.parentElement.querySelector('input').value.split('|')[2] || '1' });
      desenhar(pop); pop.showPopover(); gatilho.setAttribute('aria-expanded', 'true'); return;
    }
    const pop = e.target.closest('.periodo-pop'); if (!pop) return;
    const botao = e.target.closest('button'); if (!botao) return;
    if (botao.hasAttribute('data-periodo-cancelar')) return pop.hidePopover();
    if (botao.hasAttribute('data-periodo-aplicar')) {
      const ini = pop.querySelector('[data-periodo-inicio]').value, fim = pop.querySelector('[data-periodo-fim]').value;
      if (!ini || !fim || ini > fim || fim > hoje()) { pop.querySelector('.periodo-erro').textContent = 'Escolha um período válido, com início antes do fim e sem datas futuras.'; return; }
      const campo = pop.parentElement.querySelector('input'); campo.value = `${ini}|${fim}${pop.dataset.comparacao === 'true' ? `|${pop.querySelector('[data-periodo-comparar]').checked ? '1' : '0'}` : ''}`; try { localStorage.setItem('hendry.periodos-recentes', JSON.stringify([`${ini}|${fim}`, ...recentes().filter((r) => r !== `${ini}|${fim}`)].slice(0, 3))); } catch {} pop.hidePopover(); campo.dispatchEvent(new Event('change', { bubbles: true })); return;
    }
    if (botao.dataset.periodoRecente) { const [ini, fim] = lerPeriodo(botao.dataset.periodoRecente); Object.assign(pop.dataset, { ini, fim, mes: mesInicial(ini, fim), selecionando: 'inicio' });
    } else if (botao.dataset.periodoAtalho) {
      const [ini, fim] = periodoPronto(botao.dataset.periodoAtalho); Object.assign(pop.dataset, { ini, fim, mes: mesInicial(ini, fim), selecionando: 'inicio' });
    } else if (botao.dataset.periodoDia) {
      const dia = botao.dataset.periodoDia;
      if (pop.dataset.selecionando === 'inicio') Object.assign(pop.dataset, { ini: dia, fim: dia, selecionando: 'fim' });
      else { const inicial = pop.dataset.ini; Object.assign(pop.dataset, { ini: dia < inicial ? dia : inicial, fim: dia < inicial ? inicial : dia, selecionando: 'inicio' }); }
    } else if (botao.dataset.periodoMes) { const d = parseData(pop.dataset.mes); d.setMonth(d.getMonth() + Number(botao.dataset.periodoMes)); pop.dataset.mes = iso(d); }
    else return;
    desenhar(pop);
  });
  document.addEventListener('change', (e) => {
    const pop = e.target.closest('.periodo-pop');
    if (pop && e.target.matches('[data-periodo-comparar]')) pop.dataset.comparar = e.target.checked ? '1' : '0';
    if (pop && (e.target.matches('[data-periodo-inicio]') || e.target.matches('[data-periodo-fim]'))) {
      const ini = pop.querySelector('[data-periodo-inicio]').value, fim = pop.querySelector('[data-periodo-fim]').value;
      if (ini && fim) { Object.assign(pop.dataset, { ini, fim }); desenhar(pop); }
    }
  });
  document.addEventListener('toggle', (e) => { if (e.target.matches?.('.periodo-pop') && e.newState === 'closed') e.target.parentElement.querySelector('.gatilho-periodo').setAttribute('aria-expanded', 'false'); }, true);
}
