import { state, actions, abrir, fechar, aviso, invalido, uid, texto } from '../core.js';
import { html, raw, attr, icon, topo, campo, vazio, dataCurta, dinheiro, dinheiroCurto, valorCampo, compacto, pct } from '../ui.js';
import { seletor, calendario } from '../widgets.js';
import { hoje, financas, centavos, TIPOS } from '../logic.js';
import { ultimasSemanas } from '../metricas.js';
import { linha } from '../graficos.js';

const SINAL = { receita: '+', custo: '-', imposto: '-', reserva: '', retirada: '-' };
const CURTO = { ...TIPOS, reserva: 'Aporte Lancer', retirada: 'Retirada Lancer' };

// Conta-giros: arco de 240 graus, do canto inferior esquerdo ao inferior direito, passando pelo topo.
const CX = 120;
const CY = 116;
const ponto = (fracao, raio) => {
  const a = ((150 + 240 * fracao) * Math.PI) / 180;
  return [CX + raio * Math.cos(a), CY + raio * Math.sin(a)].map((v) => v.toFixed(1));
};
const arco = (de, ate, raio) => {
  const [x1, y1] = ponto(de, raio);
  const [x2, y2] = ponto(ate, raio);
  return `M${x1} ${y1}A${raio} ${raio} 0 ${ate - de > 0.75 ? 1 : 0} 1 ${x2} ${y2}`;
};

function contaGiros(fracao) {
  const f = Math.min(1, Math.max(0, fracao));
  const marcas = [...Array(21)].map((_, i) => {
    const [x1, y1] = ponto(i / 20, i % 5 ? 92 : 86);
    const [x2, y2] = ponto(i / 20, 100);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${i % 5 ? 'marca' : 'marca forte'}"/>`;
  });
  const rotulos = [0, 25, 50, 75, 100].map((v) => {
    const [x, y] = ponto(v / 100, 72);
    return `<text x="${x}" y="${y}" class="rotulo">${v}</text>`;
  });
  return raw(`
    <svg class="giros" viewBox="0 0 240 176" role="img" aria-label="${pct(f)} da meta do Lancer reservado">
      <path d="${arco(0, 1, 106)}" class="trilho"/>
      ${f > 0 ? `<path d="${arco(0, f, 106)}" class="progresso"/>` : ''}
      ${marcas.join('')}${rotulos.join('')}
      <g class="ponteiro" style="--giro:${(240 * f).toFixed(1)}deg">
        <line x1="${CX}" y1="${CY}" x2="${ponto(0, 84)[0]}" y2="${ponto(0, 84)[1]}"/>
      </g>
      <circle cx="${CX}" cy="${CY}" r="7" class="eixo"/>
      <text x="${CX}" y="164" class="leitura">${pct(f)}</text>
    </svg>`);
}

function formLancamento(l) {
  return html`
    <form class="dlg-corpo" data-act="fin.salvar" data-id="${l?.id || ''}">
      ${seletor('Tipo', 'tipo', TIPOS, l?.tipo || 'receita')}
      <div class="dupla">
        ${campo('Valor (R$)', html`<input name="valor" required inputmode="decimal" autocomplete="off" value="${valorCampo(l?.valor)}" placeholder="Ex.: 697,00…">`)}
        ${calendario('Data', 'data', l?.data || hoje(), { max: hoje(), obrigatorio: true })}
      </div>
      ${campo('Descrição', html`<input name="descricao" value="${l?.descricao || ''}" autocomplete="off" placeholder="Ex.: implantação do atendente…">`)}
      ${campo('Cliente ou projeto', html`<input name="cliente" value="${l?.cliente || ''}" autocomplete="off">`)}
      <label class="marcar"><input type="checkbox" name="recebido" ${attr('checked', l?.recebido !== false)}><span>Receita já recebida</span></label>
      <small>Receita a receber fica registrada, mas não entra em nenhuma soma. Salário não entra aqui: só projetos paralelos.</small>
      <footer class="dlg-acoes">
        ${l && html`<button type="button" class="btn btn-t perigo" data-act="fin.excluir" data-id="${l.id}">Excluir</button>`}
        <button class="btn btn-p">Salvar lançamento</button>
      </footer>
    </form>`;
}

export function render() {
  const f = financas(state.financas);
  const meta = state.settings.metaLancer;
  const lista = [...state.financas].sort((a, b) => b.data.localeCompare(a.data));
  const semanas = ultimasSemanas(state, hoje(), 12, dataCurta);
  const reservas = semanas.serie.map((s) => s.reservado);

  return html`
    ${topo('Lancer', 'Só entra dinheiro de projeto paralelo que já foi reservado')}

    <section class="card placar" aria-labelledby="h-placar">
      ${contaGiros(meta > 0 ? f.reservado / meta : 0)}
      <h2 id="h-placar" class="sr">Reserva do Lancer</h2>
      <p class="valor"><b class="num">${dinheiroCurto(f.reservado)}</b> reservados</p>
      ${meta > 0
        ? html`<p class="nota">de ${dinheiroCurto(meta)} · faltam ${dinheiroCurto(Math.max(0, meta - f.reservado))}</p>`
        : html`
          <form class="meta-form" data-act="fin.meta">
            ${campo('Quanto custa o Lancer, com documentação e reserva?', html`<input name="meta" required inputmode="decimal" autocomplete="off" placeholder="Ex.: 85.000…">`)}
            <button class="btn btn-s">Definir meta</button>
          </form>`}
    </section>

    <dl class="stats dinheiro">
      <div><dt>recebido</dt><dd class="num">${dinheiroCurto(f.recebido)}</dd></div>
      <div><dt>custos e impostos</dt><dd class="num">${dinheiroCurto(f.custos + f.impostos)}</dd></div>
      <div><dt>resultado estimado</dt><dd class="num">${dinheiroCurto(f.resultado)}</dd></div>
    </dl>
    ${f.aReceber > 0 && html`<p class="nota">A receber: ${dinheiro(f.aReceber)}. Não conta até cair na conta.</p>`}

    ${reservas.some((v) => v !== 0) && html`
      <section class="bloco">
        ${linha({
          ...semanas,
          titulo: 'Reserva nas últimas 12 semanas',
          nome: 'Reservado',
          // Antes do primeiro aporte não há ponto: a linha começa onde a reserva começa.
          valores: reservas.map((v, i) => (reservas.slice(0, i + 1).every((x) => x === 0) ? null : v)),
          formato: dinheiro,
          eixo: (c) => `R$ ${compacto(c / 100)}`,
          zero: true,
          meta: meta > 0 && { valor: meta, rotulo: 'meta' },
        })}
      </section>`}

    <div class="barra">
      <h2>Lançamentos</h2>
      <button class="btn btn-p" data-act="fin.novo">${icon('plus')} Novo lançamento</button>
    </div>

    ${lista.length === 0
      ? vazio('Nada lançado ainda. Receita entra aqui; o placar só anda quando você registra um aporte na reserva.')
      : html`
        <ul class="linhas">
          ${lista.map((l) => html`
            <li>
              <button class="linha" data-act="fin.abrir" data-id="${l.id}">
                <span class="principal">${l.descricao || CURTO[l.tipo]}</span>
                <span class="lado num">${SINAL[l.tipo]}${dinheiro(l.valor)}</span>
                <span class="detalhe">${dataCurta(l.data)} · ${CURTO[l.tipo]}${l.tipo === 'receita' && l.recebido === false ? ' a receber' : ''}${l.cliente && html`, ${l.cliente}`}</span>
              </button>
            </li>`)}
        </ul>`}`;
}

Object.assign(actions, {
  'fin.meta': ({ meta }, form) => {
    const v = centavos(meta);
    if (!(v > 0)) return invalido(form.elements.meta, 'Use um valor como 85.000.');
    state.settings.metaLancer = v;
  },

  'fin.novo': () => {
    abrir('Novo lançamento', formLancamento());
    return false;
  },

  'fin.abrir': ({ id }) => {
    const l = state.financas.find((x) => x.id === id);
    if (l) abrir(CURTO[l.tipo], formLancamento(l));
    return false;
  },

  'fin.salvar': (f, form) => {
    const valor = centavos(f.valor);
    if (!(valor > 0)) return invalido(form.elements.valor, 'Use um número como 697,00.');
    if (!TIPOS[f.tipo]) return false;
    const atual = state.financas.find((x) => x.id === f.id);
    // A reserva não pode ficar negativa: retirada maior que o que existe é erro de digitação.
    const outros = state.financas.filter((x) => x !== atual);
    const reservaDepois = financas([...outros, { tipo: f.tipo, valor }]).reservado;
    if (reservaDepois < 0) return invalido(form.elements.valor, `Maior que a reserva. Disponível: ${dinheiro(financas(outros).reservado)}.`);

    const l = atual || { id: uid() };
    if (!atual) state.financas.push(l);
    Object.assign(l, { tipo: f.tipo, valor, data: f.data, descricao: texto(f.descricao), cliente: texto(f.cliente), recebido: f.tipo !== 'receita' || f.recebido === 'on' });
    fechar();
  },

  'fin.excluir': ({ id }) => {
    const resto = state.financas.filter((l) => l.id !== id);
    if (financas(resto).reservado < 0) return aviso('Sem este aporte a reserva ficaria negativa. Ajuste as retiradas antes.'), false;
    if (!confirm('Excluir este lançamento?')) return false;
    state.financas = resto;
    fechar();
  },
});
