// Dinheiro: o placar do Lancer, a análise do mês (de onde vem, para onde vai, onde economizar) e os lançamentos.
import { state, actions, abrir, fechar, aviso, invalido, uid, texto } from '../core.js';
import { html, raw, attr, icon, topo, campo, vazio, dataCurta, dinheiro, dinheiroCurto, valorCampo, compacto, pct } from '../ui.js';
import { seletor, calendario } from '../widgets.js';
import { hoje, parseData, financas, centavos, categoriaDe, TIPOS, CATEGORIAS } from '../logic.js';
import { ultimasSemanas } from '../metricas.js';
import { fluxoDoMes, economia, prospeccaoEmDinheiro, mesDe, mesAntes } from '../analise.js';
import { linha, barrasH } from '../graficos.js';

const ABAS = { placar: 'Lancer', analise: 'Análise', lancamentos: 'Lançamentos' };
const SUBTITULO = {
  placar: 'O placar só anda com dinheiro de projeto paralelo já reservado',
  analise: 'De onde vem, para onde vai e onde dá para economizar',
  lancamentos: 'Tudo que entrou e saiu',
};
const SINAL = { receita: '+', custo: '-', imposto: '-', reserva: '', retirada: '-' };
const CURTO = { ...TIPOS, reserva: 'Aporte Lancer', retirada: 'Retirada Lancer' };
const nomeDoMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const umaCasa = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

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

// `l` pode ser um lançamento salvo ou o que já foi digitado em um lançamento novo (quando o tipo muda).
function formLancamento(l) {
  const tipo = TIPOS[l?.tipo] ? l.tipo : 'custo';
  const categorias = CATEGORIAS[tipo];
  return html`
    <form class="dlg-corpo" data-act="fin.salvar" data-id="${l?.id || ''}">
      ${seletor('Tipo', 'tipo', TIPOS, tipo, { mudou: 'fin.tipo' })}
      ${categorias && seletor(tipo === 'receita' ? 'De onde veio' : 'Categoria', 'categoria', categorias, l?.id ? categoriaDe(l) : l?.categoria, { vazio: 'Escolher' })}
      <div class="dupla">
        ${campo('Valor (R$)', html`<input name="valor" required inputmode="decimal" autocomplete="off" value="${valorCampo(l?.valor)}" placeholder="Ex.: 35,00…">`)}
        ${calendario('Data', 'data', l?.data || hoje(), { max: hoje(), obrigatorio: true })}
      </div>
      ${campo('Descrição', html`<input name="descricao" value="${l?.descricao || ''}" autocomplete="off" placeholder="${tipo === 'receita' ? 'Ex.: implantação do atendente…' : 'Ex.: almoço, internet, gasolina…'}">`)}
      ${tipo === 'receita' && html`
        ${campo('Cliente ou projeto', html`<input name="cliente" value="${l?.cliente || ''}" autocomplete="off">`)}
        <label class="marcar"><input type="checkbox" name="recebido" ${attr('checked', l?.recebido !== false)}><span>Receita já recebida</span></label>
        <small>Receita a receber fica registrada, mas não entra em nenhuma soma. Salário aparece na análise do mês e nunca mexe no placar do Lancer.</small>`}
      <footer class="dlg-acoes">
        ${l?.id && html`<button type="button" class="btn btn-t perigo" data-act="fin.excluir" data-id="${l.id}">Excluir</button>`}
        <button class="btn btn-p">Salvar lançamento</button>
      </footer>
    </form>`;
}

// ---------- Placar do Lancer ----------

function placar() {
  const f = financas(state.financas);
  const meta = state.settings.metaLancer;
  const semanas = ultimasSemanas(state, hoje(), 12, dataCurta);
  const reservas = semanas.serie.map((s) => s.reservado);

  return html`
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

    <section class="bloco" aria-labelledby="h-negocio">
      <h2 id="h-negocio">Projetos paralelos</h2>
      <dl class="stats dinheiro">
        <div><dt>recebido de clientes</dt><dd class="num">${dinheiroCurto(f.recebido)}</dd></div>
        <div><dt>custos e impostos</dt><dd class="num">${dinheiroCurto(f.custos + f.impostos)}</dd></div>
        <div><dt>resultado estimado</dt><dd class="num">${dinheiroCurto(f.resultado)}</dd></div>
      </dl>
      ${f.aReceber > 0 && html`<p class="nota">A receber: ${dinheiro(f.aReceber)}. Não conta até cair na conta.</p>`}
      <p class="nota">Salário e gastos pessoais ficam fora desta conta. Eles aparecem na aba Análise.</p>
    </section>

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
      </section>`}`;
}

// ---------- Análise do mês ----------

let mesEscolhido = null; // null = mês corrente

function analise() {
  const ref = hoje();
  const atual = mesDe(ref);
  const mes = mesEscolhido || atual;
  const meses = Object.fromEntries([...Array(6)].map((_, i) => {
    const m = mesAntes(atual, i);
    const nome = nomeDoMes.format(parseData(`${m}-15`));
    return [m, nome[0].toUpperCase() + nome.slice(1)];
  }));
  const f = fluxoDoMes(state.financas, mes);
  const e = economia(state.financas, mes, ref);
  const p = prospeccaoEmDinheiro(state, ref);
  const parte = (linhas, todo) => linhas.map((l) => ({ nome: l.nome, valor: l.valor, nota: pct(l.valor / todo), detalhe: `${pct(l.valor / todo)} do total` }));
  const comparado = (l) => (l.acima > 0 ? `${dinheiro(l.acima)} acima da sua média` : l.acima < 0 ? `${dinheiro(-l.acima)} abaixo da sua média` : 'igual à sua média');

  return html`
    <div class="barra filtros">
      ${seletor('Mês', 'mes', meses, mes, { mudou: 'fin.mes', oculto: true })}
      <button class="btn btn-s" data-act="fin.novo">${icon('plus')} Lançar</button>
    </div>

    <dl class="stats dinheiro">
      <div><dt>entrou</dt><dd class="num">${dinheiroCurto(f.entrou)}</dd></div>
      <div><dt>saiu</dt><dd class="num">${dinheiroCurto(f.saiu)}</dd></div>
      <div><dt>${f.sobra < 0 ? 'faltou' : 'sobrou'}</dt><dd class="num">${dinheiroCurto(Math.abs(f.sobra))}</dd>${f.entrou > 0 && f.sobra > 0 && html`<dd class="sub">${pct(f.sobra / f.entrou)} do que entrou</dd>`}</div>
    </dl>
    ${f.guardado !== 0 && html`<p class="nota">${f.guardado > 0 ? 'Guardado na' : 'Retirado da'} reserva do Lancer neste mês: ${dinheiro(Math.abs(f.guardado))}.</p>`}
    ${f.entrou + f.saiu === 0 && html`<p class="nota">Nada lançado neste mês. Conte para a assistente o que entrou e o que você gastou, ou use o botão Lançar.</p>`}

    <section class="bloco">
      <div class="painel">
        ${barrasH({ titulo: 'De onde vem', sub: 'Receita que já caiu na conta, por fonte.', linhas: parte(f.entradas, f.entrou), formato: dinheiro, colunaNota: 'Parte', vazio: 'Nenhuma receita neste mês.' })}
        ${barrasH({ titulo: 'Para onde vai', sub: 'Gastos e impostos, por categoria.', linhas: parte(f.saidas, f.saiu), formato: dinheiro, colunaNota: 'Parte', vazio: 'Nenhum gasto neste mês.' })}
      </div>
    </section>

    <section class="bloco" aria-labelledby="h-eco">
      <h2 id="h-eco">Onde dá para economizar</h2>
      ${e.linhas.length === 0
        ? html`<p class="nota">Lance os gastos com categoria (mercado, comer fora, transporte) e aqui aparece onde o dinheiro pesa mais.</p>`
        : html`
          <p class="nota">Gastos que você decide mês a mês, do maior para o menor. Moradia, parcelas, impostos e custos do negócio ficam de fora.</p>
          <ul class="linhas">
            ${e.linhas.map((l) => html`
              <li>
                <span class="linha">
                  <span class="principal">${l.nome}</span>
                  <span class="lado num">${dinheiro(l.valor)}</span>
                  <span class="detalhe">${pct(l.parte)} do que saiu${l.media != null && html` · ${comparado(l)}`}</span>
                </span>
              </li>`)}
          </ul>
          <p class="achado">Cortar 10% ${e.linhas.length > 1 ? `dos ${Math.min(3, e.linhas.length)} maiores` : 'desse gasto'} libera <b>${dinheiro(e.corte10)}</b> por mês.</p>
          <p class="nota">${e.meses > 0
            ? `Média ${e.meses === 1 ? 'do mês anterior' : `dos ${e.meses} meses anteriores`} com lançamento${e.parcial ? `, contada até o dia ${Number(ref.slice(8))} de cada um` : ''}.`
            : 'Ainda sem mês anterior para comparar.'}</p>`}
    </section>

    <section class="bloco" aria-labelledby="h-rende">
      <h2 id="h-rende">Quanto a prospecção rende</h2>
      ${p.porAbordagem == null
        ? html`<p class="nota">Ainda sem cliente fechado, então não existe valor por abordagem. Até aqui: ${p.funil.abordados} ${p.funil.abordados === 1 ? 'lead abordado' : 'leads abordados'}, ${p.funil.responderam} com resposta.</p>`
        : html`
          <dl class="stats dinheiro">
            <div><dt>recebido de clientes</dt><dd class="num">${dinheiroCurto(p.receita)}</dd></div>
            <div><dt>por cliente fechado</dt><dd class="num">${dinheiroCurto(p.ticket)}</dd></div>
            <div><dt>por abordagem</dt><dd class="num">${dinheiroCurto(p.porAbordagem)}</dd><dd class="sub">${p.abordagensPorCliente} ${p.abordagensPorCliente === 1 ? 'abordagem' : 'abordagens'} para 1 cliente</dd></div>
          </dl>
          <p class="achado">No ritmo das últimas 4 semanas, a conta dá <b>${dinheiro(p.porMesNoRitmo)}</b> por mês.</p>
          <p class="nota">${umaCasa(p.novasPorSemana)} ${p.novasPorSemana === 1 ? 'abordagem nova' : 'abordagens novas'} por semana. Cada abordagem a mais por semana soma cerca de ${dinheiro(Math.round((52 / 12) * p.porAbordagem))} por mês. Conta feita com ${p.funil.ganhos} ${p.funil.ganhos === 1 ? 'cliente' : 'clientes'} e ${p.funil.abordados} abordados: com base pequena, é só uma referência.</p>`}
      ${p.gargalo && html`
        <p class="achado">Onde o funil mais vaza: <b>${p.gargalo.nome}</b>, ${p.gargalo.valor} em ${p.gargalo.base}.</p>
        <p class="nota">${p.gargalo.dica}</p>`}
      <div class="acoes"><a class="btn btn-s" href="#/negocio">Abrir o funil</a></div>
    </section>`;
}

// ---------- Lançamentos ----------

function lancamentos() {
  const lista = [...state.financas].sort((a, b) => b.data.localeCompare(a.data));
  return html`
    <div class="barra">
      <h2>Lançamentos</h2>
      <button class="btn btn-p" data-act="fin.novo">${icon('plus')} Novo lançamento</button>
    </div>
    ${lista.length === 0
      ? vazio('Nada lançado ainda. Conte para a assistente o que entrou e o que você gastou, ou lance aqui.')
      : html`
        <ul class="linhas">
          ${lista.map((l) => html`
            <li>
              <button class="linha" data-act="fin.abrir" data-id="${l.id}">
                <span class="principal">${l.descricao || CATEGORIAS[l.tipo]?.[categoriaDe(l)] || CURTO[l.tipo]}</span>
                <span class="lado num">${SINAL[l.tipo]}${dinheiro(l.valor)}</span>
                <span class="detalhe">${dataCurta(l.data)} · ${CURTO[l.tipo]}${CATEGORIAS[l.tipo] && html`, ${CATEGORIAS[l.tipo][categoriaDe(l)]}`}${l.tipo === 'receita' && l.recebido === false ? ' a receber' : ''}${l.cliente && html`, ${l.cliente}`}</span>
              </button>
            </li>`)}
        </ul>`}`;
}

export function render(aba) {
  if (!ABAS[aba]) aba = 'placar';
  return html`
    ${topo('Dinheiro', SUBTITULO[aba])}
    <nav class="abas" aria-label="Seções de Dinheiro">
      ${Object.entries(ABAS).map(([k, nome]) => html`<a href="#/lancer/${k}" ${attr('aria-current="page"', k === aba)}>${nome}</a>`)}
    </nav>
    ${{ placar, analise, lancamentos }[aba]()}`;
}

Object.assign(actions, {
  'fin.meta': ({ meta }, form) => {
    const v = centavos(meta);
    if (!(v > 0)) return invalido(form.elements.meta, 'Use um valor como 85.000.');
    state.settings.metaLancer = v;
  },

  'fin.mes': ({ valor }) => {
    mesEscolhido = valor === mesDe(hoje()) ? null : valor;
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

  // Cada tipo tem suas categorias: trocar o tipo redesenha o formulário sem perder o que já foi digitado.
  'fin.tipo': ({ valor }, campoTipo) => {
    const form = campoTipo.closest('form');
    const f = Object.fromEntries(new FormData(form));
    const salvo = state.financas.find((x) => x.id === form.dataset.id);
    abrir(salvo ? CURTO[valor] : 'Novo lançamento', formLancamento({ ...salvo, tipo: valor, categoria: '', valor: centavos(f.valor) || 0, data: f.data, descricao: f.descricao, cliente: f.cliente ?? salvo?.cliente, ...(salvo && { id: salvo.id }) }));
    return false;
  },

  'fin.salvar': (f, form) => {
    const valor = centavos(f.valor);
    if (!TIPOS[f.tipo]) return false;
    if (CATEGORIAS[f.tipo] && !CATEGORIAS[f.tipo][f.categoria]) return invalido(form.elements.categoria, f.tipo === 'receita' ? 'Escolha de onde veio.' : 'Escolha a categoria.');
    if (!(valor > 0)) return invalido(form.elements.valor, 'Use um número como 35,00.');
    const atual = state.financas.find((x) => x.id === f.id);
    // A reserva não pode ficar negativa: retirada maior que o que existe é erro de digitação.
    const outros = state.financas.filter((x) => x !== atual);
    const reservaDepois = financas([...outros, { tipo: f.tipo, valor }]).reservado;
    if (reservaDepois < 0) return invalido(form.elements.valor, `Maior que a reserva. Disponível: ${dinheiro(financas(outros).reservado)}.`);

    const l = atual || { id: uid() };
    if (!atual) state.financas.push(l);
    Object.assign(l, {
      tipo: f.tipo,
      categoria: CATEGORIAS[f.tipo] ? f.categoria : '',
      valor,
      data: f.data,
      descricao: texto(f.descricao),
      cliente: f.tipo === 'receita' ? texto(f.cliente) : atual?.cliente || '',
      recebido: f.tipo !== 'receita' || f.recebido === 'on',
    });
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
