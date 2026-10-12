// Gráficos do app, em HTML e CSS (o SVG entra só para o traço das linhas). Assim eles acompanham a largura
// da tela sem medir nada em JavaScript, e as cores vêm dos mesmos tokens do tema, no claro e no escuro.
//
// Regras seguidas em todos: marcas finas, um eixo só, e todo valor alcançável sem passar o mouse (tabela
// embaixo de cada gráfico). A leitura por toque, mouse ou setas do teclado mostra a mesma dica.
//
// Cor, como no conta-giros do Lancer: as marcas são neutras (`sn`) e o vermelho do app (`s1`) aponta só o
// período atual, que ainda está em andamento e por isso costuma estar mais baixo. `s0` é o cinza de contexto.
// Não há cor fazendo papel de categoria: quando duas medidas dividem um gráfico, uma é clara e a outra cinza,
// diferença que não depende de enxergar matiz, e a legenda diz qual é qual.
import { html, raw, n, resumo } from './ui.js';
import { teto } from './metricas.js';

const pct = (v, topo) => `${Math.round((v / topo) * 1000) / 10}%`;

const figura = (titulo, sub, miolo) => html`
  <figure class="graf">
    <figcaption><b>${titulo}</b>${sub && html`<span>${sub}</span>`}</figcaption>
    ${miolo}
  </figure>`;

const semDados = (texto) => html`<p class="graf-vazio">${texto || 'Sem registros neste período.'}</p>`;

// A legenda também nomeia a linha da meta (chave tracejada): escrita dentro do gráfico, ela passaria por cima das barras.
const legenda = (itens) => itens.length > 0 && html`<ul class="graf-legenda">${itens.map(([cor, nome]) => html`<li><i class="${cor}"></i>${nome}</li>`)}</ul>`;

// Todo gráfico tem a sua tabela: é por ela que o valor exato chega a quem não usa mouse nem enxerga a cor.
const tabela = (cabecalho, linhas) => html`
  <details class="graf-tabela">
    ${resumo('Ver em tabela')}
    <div class="rolagem">
      <table>
        <thead><tr>${cabecalho.map((c) => html`<th scope="col">${c}</th>`)}</tr></thead>
        <tbody>${linhas.map(([primeira, ...resto]) => html`<tr><th scope="row">${primeira}</th>${resto.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
      </table>
    </div>
  </details>`;

// Três marcas no eixo: topo, meio e base. Em contagem, o meio some quando não é inteiro (2,5 leads não existe).
const eixoY = (base, topo, eixo, inteiro) => {
  const meio = (base + topo) / 2;
  return html`<div class="graf-y" aria-hidden="true"><span>${eixo(topo)}</span><span>${inteiro && !Number.isInteger(meio) ? '' : eixo(meio)}</span><span>${eixo(base)}</span></div>`;
};

// Com muitos períodos, mostra um rótulo sim e outros não, sempre incluindo o mais recente.
const eixoX = (rotulos, destaque) => {
  const passo = rotulos.length > 16 ? 4 : rotulos.length > 8 ? 2 : 1;
  const ultimo = rotulos.length - 1;
  return html`<div class="graf-x" aria-hidden="true">${rotulos.map((r, i) => html`<span class="${destaque && i === ultimo ? 'atual' : ''}">${(ultimo - i) % passo === 0 ? r : ''}</span>`)}</div>`;
};

const grade = html`<i class="graf-grade" style="bottom:100%"></i><i class="graf-grade" style="bottom:50%"></i>`;
const cabe = (meta, base, topo) => Boolean(meta) && meta.valor > base && meta.valor <= topo;
const linhaDaMeta = (meta, base, topo) => cabe(meta, base, topo) && html`<i class="graf-meta" style="bottom:${pct(meta.valor - base, topo - base)}"></i>`;

// Barras verticais por período. series: [{ nome, valores, cor }].
// Uma série: barras neutras, com o último período em vermelho quando `destaque` traz o nome dele ("semana atual").
// Duas séries: lado a lado, cada uma com a sua cor e legenda. `extras` são colunas que só aparecem na tabela.
export function barras({ titulo, sub, rotulos, longos = rotulos, series, formato = n, eixo = formato, meta, inteiro = true, destaque, chave = true, extras = [], vazio }) {
  const pico = Math.max(0, ...series.flatMap((s) => s.valores.map((v) => v || 0)));
  if (!(pico > 0)) return figura(titulo, sub, semDados(vazio));
  const topo = teto(Math.max(pico, meta?.valor || 0));
  const unica = series.length === 1;
  const ultimo = rotulos.length - 1;
  const cor = (s, i) => (unica ? (destaque && i === ultimo ? 's1' : 'sn') : s.cor);

  return figura(titulo, sub, html`
    ${legenda([
      ...(unica ? (destaque && chave ? [['s1', destaque]] : []) : series.map((s) => [s.cor, s.nome])),
      ...(cabe(meta, 0, topo) ? [['meta', meta.rotulo]] : []),
    ])}
    <div class="graf-corpo">
      ${eixoY(0, topo, eixo, inteiro)}
      <div class="graf-plano${unica ? '' : ' g-pares'}" data-graf tabindex="0" role="group" aria-label="${titulo}. Use as setas para percorrer os períodos.">
        ${grade}${linhaDaMeta(meta, 0, topo)}
        ${rotulos.map((_, i) => html`
          <div class="graf-col" data-rotulo="${longos[i]}">
            ${series.filter((s) => s.valores[i] > 0).map((s) => html`<i class="graf-barra ${cor(s, i)}" style="height:max(2px, ${pct(s.valores[i], topo)})" data-nome="${s.nome}" data-valor="${formato(s.valores[i])}"></i>`)}
          </div>`)}
      </div>
      ${eixoX(rotulos, unica && destaque)}
    </div>
    ${tabela(
      ['Período', ...series.map((s) => s.nome), ...extras.map((e) => e.nome)],
      rotulos.map((_, i) => [longos[i], ...[...series, ...extras].map((s) => (s.valores[i] == null ? 'sem registro' : (s.formato || formato)(s.valores[i])))]),
    )}`);
}

// Barras horizontais para comparar itens com nome (etapas do funil, etapas da pauta, frentes de trabalho).
// linhas: [{ nome, valor, nota, detalhe }]. `nota` aparece ao lado do valor; `detalhe` vai para a dica e a tabela.
export function barrasH({ titulo, sub, linhas, formato = n, colunaNota, vazio }) {
  const pico = Math.max(0, ...linhas.map((l) => l.valor));
  if (!(pico > 0)) return figura(titulo, sub, semDados(vazio));
  return figura(titulo, sub, html`
    <div class="graf-linhas" data-graf="h" tabindex="0" role="group" aria-label="${titulo}. Use as setas para percorrer as linhas.">
      ${linhas.map((l) => html`
        <div class="graf-col" data-rotulo="${l.nome}">
          <span class="nome">${l.nome}</span>
          <span class="trilho"><i class="sn" style="width:${l.valor > 0 ? `max(2px, ${pct(l.valor, pico)})` : '0'}" data-nome="${l.detalhe || ''}" data-valor="${formato(l.valor)}"></i></span>
          <span class="valor"><b>${formato(l.valor)}</b>${l.nota && html`<small>${l.nota}</small>`}</span>
        </div>`)}
    </div>
    ${tabela(['Item', 'Valor', ...(colunaNota ? [colunaNota] : [])], linhas.map((l) => [l.nome, formato(l.valor), ...(colunaNota ? [l.detalhe || l.nota || ''] : [])]))}`);
}

// Linha no tempo para uma medida só. Valor null é período sem registro: a linha passa direto, sem inventar ponto.
// Com `zero`, o eixo começa no zero e a área é preenchida (saldo acumulado). Sem ele, o eixo acompanha os dados (peso).
// O último ponto registrado fica marcado em vermelho.
export function linha({ titulo, sub, rotulos, longos = rotulos, valores, nome, formato = n, eixo = formato, meta, zero = false, vazio }) {
  const pontos = valores.map((v, i) => ({ i, v })).filter((p) => p.v != null);
  if (pontos.length === 0) return figura(titulo, sub, semDados(vazio));
  const vs = pontos.map((p) => p.v);
  const [min, max] = [Math.min(...vs), Math.max(...vs)];
  const folga = Math.max((max - min) * 0.25, Math.abs(max) * 0.02, 0.5);
  const base = zero ? 0 : Math.floor(min - folga);
  const topo = zero ? teto(Math.max(max, meta && meta.valor <= max * 2 ? meta.valor : 0)) : Math.ceil(max + folga);
  const x = (p) => ((p.i + 0.5) / valores.length) * 100;
  const y = (p) => ((p.v - base) / (topo - base)) * 100;
  const caminho = pontos.map((p, k) => `${k ? 'L' : 'M'}${x(p).toFixed(2)} ${(100 - y(p)).toFixed(2)}`).join('');
  const fim = pontos.at(-1).i;

  return figura(titulo, sub, html`
    ${legenda(cabe(meta, base, topo) ? [['meta', meta.rotulo]] : [])}
    <div class="graf-corpo">
      ${eixoY(base, topo, eixo, false)}
      <div class="graf-plano g-traco" data-graf tabindex="0" role="group" aria-label="${titulo}. Use as setas para percorrer os períodos.">
        ${grade}${linhaDaMeta(meta, base, topo)}
        ${raw(`<svg class="graf-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${zero && pontos.length > 1 ? `<path class="area" d="${caminho}L${x(pontos.at(-1)).toFixed(2)} 100L${x(pontos[0]).toFixed(2)} 100Z"/>` : ''}
          <path class="traco" d="${caminho}"/>
        </svg>`)}
        ${valores.map((v, i) => html`
          <div class="graf-col" data-rotulo="${longos[i]}">
            ${v != null && html`<i class="ponto ${i === fim ? 's1 fim' : 'sn'}" style="bottom:${y({ v }).toFixed(2)}%" data-nome="${nome}" data-valor="${formato(v)}"></i>`}
          </div>`)}
      </div>
      ${eixoX(rotulos, false)}
    </div>
    ${tabela(['Período', nome], rotulos.map((_, i) => [longos[i], valores[i] == null ? 'sem registro' : formato(valores[i])]))}`);
}

// ---------- Leitura: uma dica só, para todos os gráficos ----------
// A coluna (ou a linha) inteira é a área de toque, não só a marca pintada.

let dica;
const novo = (tag, texto, classe) => {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  el.textContent = texto; // textContent: nome vindo do usuário nunca vira HTML
  return el;
};

function esconder() {
  if (dica.hidden) return;
  dica.hidden = true;
  document.querySelector('.graf-col.ativo')?.classList.remove('ativo');
}

function mostrar(col) {
  if (!col) return;
  if (!col.classList.contains('ativo')) {
    document.querySelector('.graf-col.ativo')?.classList.remove('ativo');
    col.classList.add('ativo');
    const itens = [...col.querySelectorAll('[data-valor]')];
    dica.replaceChildren(
      novo('b', col.dataset.rotulo),
      ...(itens.length === 0
        ? [novo('span', 'Sem registro')]
        : itens.map((it) => {
            const linhaDica = novo('span', '');
            // O valor vem primeiro e forte; o nome da medida depois. A chave é um traço na cor da marca.
            linhaDica.append(novo('i', '', it.className.match(/\bs[n\d]\b/)?.[0]), novo('strong', it.dataset.valor), it.dataset.nome ? ` ${it.dataset.nome}` : '');
            return linhaDica;
          })),
    );
  }
  dica.hidden = false;
  const grafico = col.closest('[data-graf]');
  const plano = grafico.getBoundingClientRect();
  const c = col.getBoundingClientRect();
  const d = dica.getBoundingClientRect();
  const deitado = grafico.dataset.graf === 'h';
  const acima = (deitado ? c.top : plano.top) - d.height - 6;
  dica.style.top = `${acima >= 8 ? acima : (deitado ? c.bottom : plano.bottom) + 6}px`;
  dica.style.left = `${Math.max(8, Math.min((deitado ? plano.left + plano.width / 2 : c.left + c.width / 2) - d.width / 2, innerWidth - d.width - 8))}px`;
}

export function iniciar() {
  dica = Object.assign(document.createElement('div'), { id: 'dica', hidden: true });
  dica.setAttribute('role', 'status');
  document.body.append(dica);

  const apontar = (e) => {
    const col = e.target.closest?.('[data-graf] > .graf-col');
    if (col) mostrar(col);
    else esconder();
  };
  document.addEventListener('pointermove', apontar);
  document.addEventListener('pointerdown', apontar);
  document.addEventListener('scroll', esconder, true);
  addEventListener('hashchange', esconder);

  // Teclado: o gráfico é uma parada só no Tab; as setas andam pelos períodos.
  document.addEventListener('keydown', (e) => {
    const plano = e.target.closest?.('[data-graf]');
    if (!plano) return;
    if (e.key === 'Escape') return esconder();
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!passo) return;
    e.preventDefault();
    const cols = [...plano.querySelectorAll(':scope > .graf-col')];
    const atual = cols.findIndex((c) => c.classList.contains('ativo'));
    mostrar(cols[atual < 0 ? cols.length - 1 : Math.max(0, Math.min(atual + passo, cols.length - 1))]);
  });
  document.addEventListener('focusin', (e) => {
    const plano = e.target.closest?.('[data-graf]');
    if (plano?.matches(':focus-visible')) mostrar(plano.querySelector(':scope > .graf-col:last-of-type'));
  });
  document.addEventListener('focusout', (e) => e.target.closest?.('[data-graf]') && esconder());
}
