import { state, actions, abrir, fechar, dialogoAberto, aviso, invalido, uid, texto } from '../core.js';
import { html, attr, icon, topo, campo, vazio, dataCurta, dataMedia, n } from '../ui.js';
import { hoje, somaDias, inicioSemana, diaSemana, somaMacros, num } from '../logic.js';
import { reduzirFoto, analisarRefeicao } from '../gemini.js';

const ABAS = { treino: 'Treino', comida: 'Alimentação', medidas: 'Medidas' };
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const NOMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SEMANA = [1, 2, 3, 4, 5, 6, 0]; // segunda primeiro
const CONFIANCA = { baixa: 'baixa', media: 'média', alta: 'alta' };
const inteiro = (v) => Math.max(0, Math.round(num(v) || 0));
const macros = (m) => `P ${n(m.p)} g, C ${n(m.c)} g, G ${n(m.g)} g`;

// ---------- Treino ----------

let editandoDias = false; // mantém a lista de dias aberta enquanto a pessoa marca vários

function formTreino(t) {
  const tipos = [...new Set(state.treinos.map((x) => x.tipo).filter(Boolean))];
  return html`
    <form class="dlg-corpo" data-act="treino.salvar" data-id="${t?.id || ''}">
      <div class="dupla">
        ${campo('Data', html`<input type="date" name="data" required value="${t?.data || hoje()}">`)}
        ${campo('Duração (min)', html`<input name="min" inputmode="numeric" value="${t?.min || ''}" autocomplete="off">`)}
      </div>
      ${campo('Treino', html`<input name="tipo" list="tipos-treino" value="${t?.tipo || ''}" autocomplete="off" placeholder="Ex.: peito e tríceps…">`)}
      <datalist id="tipos-treino">${tipos.map((x) => html`<option value="${x}">`)}</datalist>
      ${campo('Observações', html`<textarea name="obs" rows="3" placeholder="Cargas, como se sentiu…">${t?.obs || ''}</textarea>`)}
      <footer class="dlg-acoes">
        ${t && html`<button type="button" class="btn btn-t perigo" data-act="treino.excluir" data-id="${t.id}">Excluir</button>`}
        <button class="btn btn-p">Salvar treino</button>
      </footer>
    </form>`;
}

function treino() {
  const d = hoje();
  const ini = inicioSemana(d);
  const planejados = state.settings.diasTreino;
  const feitos = new Set(state.treinos.map((t) => t.data));
  const semana = SEMANA.map((_, i) => somaDias(ini, i));
  const naSemana = semana.filter((x) => feitos.has(x)).length;
  const recentes = [...state.treinos].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30);

  return html`
    <ol class="tira" aria-label="Treinos desta semana">
      ${semana.map((x) => {
        const feito = feitos.has(x);
        const plano = planejados.includes(diaSemana(x));
        return html`
          <li class="${feito ? 'feito' : plano ? 'plano' : ''} ${x === d ? 'hoje' : ''}">
            <span aria-hidden="true">${DIAS[diaSemana(x)]}</span>
            <b>${dataCurta(x).slice(0, 2)}</b>
            <span class="sr">${NOMES[diaSemana(x)]}: ${feito ? 'treino feito' : plano ? 'treino planejado' : 'sem treino'}</span>
          </li>`;
      })}
    </ol>

    <p class="linha-solta">
      <span><b class="num">${naSemana}</b>${planejados.length > 0 && html` de ${planejados.length}`} ${naSemana === 1 && planejados.length === 0 ? 'treino' : 'treinos'} nesta semana</span>
      <button class="btn btn-p" data-act="treino.novo">${icon('plus')} Registrar treino</button>
    </p>

    <details class="bloco" ${attr('open', planejados.length === 0 || editandoDias)}>
      <summary>Dias de treino planejados</summary>
      <div class="chips" role="group" aria-label="Dias de treino planejados">
        ${SEMANA.map((dia) => html`
          <label><input type="checkbox" value="${dia}" data-mudou="treino.dia" ${attr('checked', planejados.includes(dia))}><span>${NOMES[dia]}</span></label>`)}
      </div>
      <small>Treino só é esperado nesses dias. Fora deles, descanso é descanso.</small>
    </details>

    <section class="bloco" aria-labelledby="h-treinos">
      <h2 id="h-treinos">Últimos treinos</h2>
      ${recentes.length === 0
        ? vazio('Nenhum treino registrado ainda.')
        : html`
          <ul class="linhas">
            ${recentes.map((t) => html`
              <li>
                <button class="linha" data-act="treino.abrir" data-id="${t.id}">
                  <span class="principal">${t.tipo || 'Treino'}</span>
                  <span class="lado">${dataMedia(t.data)}</span>
                  <span class="detalhe">${t.min ? `${t.min} min` : ''}${t.min && t.obs ? ' · ' : ''}${t.obs}</span>
                </button>
              </li>`)}
          </ul>`}
    </section>`;
}

// ---------- Alimentação ----------

let diaEscolhido = null; // null = hoje
let foto = null; // data URL da foto em análise
let analise = null;

const img = () => html`<img class="foto" src="${foto}" alt="Foto da refeição" width="512" height="384">`;

function formRefeicao(r) {
  return html`
    <form class="dlg-corpo" data-act="comida.salvar" data-id="${r?.id || ''}">
      ${campo('Refeição', html`<input name="nome" required value="${r?.nome || ''}" autocomplete="off" placeholder="Ex.: almoço…">`)}
      <div class="dupla">
        ${campo('Calorias (kcal)', html`<input name="kcal" required inputmode="numeric" value="${r?.kcal ?? ''}" autocomplete="off">`)}
        ${campo('Proteína (g)', html`<input name="p" inputmode="numeric" value="${r?.p ?? ''}" autocomplete="off">`)}
      </div>
      <div class="dupla">
        ${campo('Carboidrato (g)', html`<input name="c" inputmode="numeric" value="${r?.c ?? ''}" autocomplete="off">`)}
        ${campo('Gordura (g)', html`<input name="g" inputmode="numeric" value="${r?.g ?? ''}" autocomplete="off">`)}
      </div>
      ${campo('Data', html`<input type="date" name="data" required value="${r?.data || diaEscolhido || hoje()}">`)}
      ${r?.itens?.length > 0 && html`
        <section>
          <h3>Itens da foto</h3>
          <ul class="historico">${r.itens.map((i) => html`<li><b>${i.nome}</b> ${i.porcao} · ${n(i.kcal)} kcal</li>`)}</ul>
        </section>`}
      <footer class="dlg-acoes">
        ${r && html`<button type="button" class="btn btn-t perigo" data-act="comida.excluir" data-id="${r.id}">Excluir</button>`}
        <button class="btn btn-p">Salvar refeição</button>
      </footer>
    </form>`;
}

function formAnalise(a, dica) {
  if (a.itens.length === 0) {
    return html`
      <div class="dlg-corpo">
        ${img()}
        <p class="erro" role="alert">Não identifiquei comida nessa foto. ${a.observacao}</p>
        <footer class="dlg-acoes">
          <button class="btn btn-s" data-act="comida.manual">Lançar à mão</button>
          <button class="btn btn-p" data-act="fechar">Tentar outra foto</button>
        </footer>
      </div>`;
  }
  return html`
    <form class="dlg-corpo" data-act="comida.salvarAnalise">
      ${img()}
      ${campo('Refeição', html`<input name="nome" required value="${a.nome}" autocomplete="off">`)}
      <fieldset class="grupo itens">
        <legend>O que a IA viu</legend>
        ${a.itens.map((i, idx) => html`
          <label class="item">
            <input type="checkbox" name="item" value="${idx}" checked data-mudou="comida.somar">
            <span><b>${i.nome}</b><small>${i.porcao} · ${macros(i)}</small></span>
            <span class="num">${n(i.kcal)}</span>
          </label>`)}
        <p class="total"><span>Total</span><b><span class="num" id="total-kcal">${n(somaMacros(a.itens).kcal)}</span> kcal</b></p>
      </fieldset>
      <p class="nota">Confiança da estimativa: ${CONFIANCA[a.confianca]}. ${a.observacao}</p>
      <div class="recalculo">
        ${campo('Algo errado? Corrija e recalcule', html`<input name="dica" value="${dica || ''}" autocomplete="off" placeholder="Ex.: eram 2 ovos e foi sem óleo…">`)}
        <button type="button" class="btn btn-s" data-act="comida.recalcular">Recalcular</button>
      </div>
      <footer class="dlg-acoes"><button class="btn btn-p">Salvar refeição</button></footer>
      <small>Estimativa de IA a partir da foto: serve de referência, não de orientação nutricional.</small>
    </form>`;
}

async function analisar(dica) {
  abrir('Refeição', html`
    <div class="dlg-corpo">
      ${img()}
      <div class="esqueleto" role="status"><p>Calculando calorias…</p><i></i><i></i><i></i></div>
    </div>`);
  let corpo;
  try {
    analise = await analisarRefeicao(foto, dica);
    corpo = formAnalise(analise, dica);
  } catch (e) {
    corpo = html`
      <div class="dlg-corpo">
        ${img()}
        <p class="erro" role="alert">${e.message}</p>
        <footer class="dlg-acoes">
          <button class="btn btn-s" data-act="comida.manual">Lançar à mão</button>
          <button class="btn btn-p" data-act="comida.recalcular">Tentar de novo</button>
        </footer>
      </div>`;
  }
  // Se o diálogo foi fechado no meio da análise, a pessoa desistiu: não reabre na cara dela.
  if (dialogoAberto()) abrir('Refeição', corpo);
}

function comida() {
  const d = diaEscolhido || hoje();
  const doDia = state.refeicoes.filter((r) => r.data === d).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  const total = somaMacros(doDia);
  const { metaKcal, metaProteina } = state.settings;
  const semana = [...Array(7)].map((_, i) => somaDias(hoje(), -i));

  return html`
    <div class="barra">
      <label class="campo em-linha">
        <span class="sr">Dia</span>
        <input type="date" value="${d}" max="${hoje()}" data-mudou="comida.dia">
      </label>
      ${d !== hoje() && html`<button class="btn btn-t" data-act="comida.hoje">Voltar para hoje</button>`}
    </div>

    <p class="placar-kcal">
      <b class="num">${n(total.kcal)}</b>
      <span>${metaKcal > 0 ? html`de ${n(metaKcal)} kcal` : 'kcal'}</span>
    </p>
    <p class="nota">${macros(total)}${metaProteina > 0 && html` · meta de proteína ${n(metaProteina)} g`}</p>

    <div class="acoes">
      <label class="btn btn-p">${icon('camera')} Foto da refeição<input class="sr" type="file" accept="image/*" capture="environment" data-mudou="comida.foto"></label>
      <label class="btn btn-s">${icon('image')} Da galeria<input class="sr" type="file" accept="image/*" data-mudou="comida.foto"></label>
      <button class="btn btn-t" data-act="comida.manual">Lançar à mão</button>
    </div>

    <section class="bloco" aria-labelledby="h-refeicoes">
      <h2 id="h-refeicoes">Refeições de ${d === hoje() ? 'hoje' : dataMedia(d)}</h2>
      ${doDia.length === 0
        ? vazio('Nada registrado neste dia. Tire uma foto do prato e a IA estima as calorias.')
        : html`
          <ul class="linhas">
            ${doDia.map((r) => html`
              <li>
                <button class="linha" data-act="comida.abrir" data-id="${r.id}">
                  <span class="principal">${r.nome}</span>
                  <span class="lado"><b class="num">${n(r.kcal)}</b> kcal</span>
                  <span class="detalhe">${r.hora} · ${macros(r)}</span>
                </button>
              </li>`)}
          </ul>`}
    </section>

    <section class="bloco" aria-labelledby="h-7dias">
      <h2 id="h-7dias">Últimos 7 dias</h2>
      <ul class="linhas compacta">
        ${semana.map((x) => {
          const t = somaMacros(state.refeicoes.filter((r) => r.data === x));
          return html`<li><span class="linha"><span class="principal">${dataMedia(x)}</span><span class="lado">${t.kcal ? html`<b class="num">${n(t.kcal)}</b> kcal` : 'sem registro'}</span></span></li>`;
        })}
      </ul>
    </section>`;
}

// ---------- Medidas ----------

function medidas() {
  const lista = [...state.medidas].sort((a, b) => b.data.localeCompare(a.data));
  const [atual] = lista;
  const primeira = lista.at(-1);
  const delta = atual && primeira !== atual ? atual.peso - primeira.peso : null;
  const kg = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  return html`
    ${atual && html`
      <p class="placar-kcal">
        <b class="num">${kg(atual.peso)}</b>
        <span>kg${delta != null && html` · ${delta > 0 ? '+' : ''}${kg(delta)} kg desde ${dataCurta(primeira.data)}`}</span>
      </p>`}

    <form class="pilha" data-act="medida.salvar">
      <div class="dupla">
        ${campo('Data', html`<input type="date" name="data" required value="${hoje()}" max="${hoje()}">`)}
        ${campo('Peso (kg)', html`<input name="peso" required inputmode="decimal" autocomplete="off" placeholder="Ex.: 78,4…">`)}
      </div>
      ${campo('Observação', html`<input name="obs" autocomplete="off" placeholder="Ex.: em jejum, pela manhã…">`)}
      <div class="acoes"><button class="btn btn-p">Registrar peso</button></div>
    </form>
    <p class="nota">Registre quando fizer sentido. Não precisa ser todo dia.</p>

    <section class="bloco" aria-labelledby="h-medidas">
      <h2 id="h-medidas">Histórico</h2>
      ${lista.length === 0
        ? vazio('Nenhuma medida registrada.')
        : html`
          <ul class="linhas compacta">
            ${lista.map((m) => html`
              <li>
                <span class="linha">
                  <span class="principal">${dataMedia(m.data)}</span>
                  <span class="lado"><b class="num">${kg(m.peso)}</b> kg <button class="ic-btn" data-act="medida.excluir" data-id="${m.id}" aria-label="Excluir medida de ${dataCurta(m.data)}">${icon('trash', 18)}</button></span>
                  ${m.obs && html`<span class="detalhe">${m.obs}</span>`}
                </span>
              </li>`)}
          </ul>`}
    </section>`;
}

export function render(aba) {
  if (!ABAS[aba]) aba = 'treino';
  return html`
    ${topo('Corpo', 'Consistência e evolução, sem meta agressiva')}
    <nav class="abas" aria-label="Seções de Corpo">
      ${Object.entries(ABAS).map(([k, nome]) => html`<a href="#/corpo/${k}" ${attr('aria-current="page"', k === aba)}>${nome}</a>`)}
    </nav>
    ${{ treino, comida, medidas }[aba]()}`;
}

Object.assign(actions, {
  // ----- treino
  'treino.novo': () => {
    abrir('Registrar treino', formTreino());
    return false;
  },
  'treino.abrir': ({ id }) => {
    const t = state.treinos.find((x) => x.id === id);
    if (t) abrir('Treino', formTreino(t));
    return false;
  },
  'treino.salvar': (f) => {
    let t = state.treinos.find((x) => x.id === f.id);
    if (!t) state.treinos.push((t = { id: uid() }));
    Object.assign(t, { data: f.data, tipo: texto(f.tipo), min: inteiro(f.min), obs: texto(f.obs) });
    fechar();
  },
  'treino.excluir': ({ id }) => {
    if (!confirm('Excluir este treino?')) return false;
    state.treinos = state.treinos.filter((t) => t.id !== id);
    fechar();
  },
  'treino.dia': (_, caixa) => {
    const dia = Number(caixa.value);
    editandoDias = true;
    const dias = state.settings.diasTreino.filter((x) => x !== dia);
    state.settings.diasTreino = caixa.checked ? [...dias, dia] : dias;
  },

  // ----- alimentação
  'comida.dia': ({ valor }) => {
    diaEscolhido = valor && valor !== hoje() ? valor : null;
  },
  'comida.hoje': () => {
    diaEscolhido = null;
  },
  'comida.foto': async (_, entrada) => {
    const arquivo = entrada.files[0];
    entrada.value = ''; // permite escolher a mesma foto de novo
    if (!arquivo) return false;
    if (!location.hash.startsWith('#/corpo')) diaEscolhido = null; // foto tirada pela tela Hoje é de hoje
    try {
      foto = await reduzirFoto(arquivo);
    } catch {
      aviso('Não consegui abrir essa imagem. Tente outra foto.');
      return false;
    }
    await analisar();
    return false;
  },
  'comida.recalcular': async (_, botao) => {
    await analisar(texto(botao.form?.dica.value));
    return false;
  },
  'comida.somar': (_, caixa) => {
    const marcados = [...caixa.form.querySelectorAll('[name=item]:checked')].map((c) => analise.itens[c.value]);
    document.getElementById('total-kcal').textContent = n(somaMacros(marcados).kcal);
    return false;
  },
  'comida.salvarAnalise': (f, form) => {
    const itens = new FormData(form).getAll('item').map((i) => analise.itens[i]);
    if (itens.length === 0) return aviso('Marque pelo menos um item ou lance à mão.'), false;
    state.refeicoes.push({
      id: uid(),
      data: diaEscolhido || hoje(),
      hora: new Date().toTimeString().slice(0, 5),
      nome: texto(f.nome),
      ...somaMacros(itens),
      itens,
      origem: 'foto',
    });
    foto = analise = null;
    fechar();
  },
  'comida.manual': () => {
    abrir('Lançar refeição', formRefeicao());
    return false;
  },
  'comida.abrir': ({ id }) => {
    const r = state.refeicoes.find((x) => x.id === id);
    if (r) abrir(r.nome, formRefeicao(r));
    return false;
  },
  'comida.salvar': (f) => {
    let r = state.refeicoes.find((x) => x.id === f.id);
    if (!r) state.refeicoes.push((r = { id: uid(), hora: new Date().toTimeString().slice(0, 5), origem: 'manual' }));
    Object.assign(r, { nome: texto(f.nome), data: f.data, kcal: inteiro(f.kcal), p: inteiro(f.p), c: inteiro(f.c), g: inteiro(f.g) });
    fechar();
  },
  'comida.excluir': ({ id }) => {
    if (!confirm('Excluir esta refeição?')) return false;
    state.refeicoes = state.refeicoes.filter((r) => r.id !== id);
    fechar();
  },

  // ----- medidas
  'medida.salvar': (f, form) => {
    const peso = num(f.peso);
    if (!(peso > 0 && peso < 500)) return invalido(form.elements.peso, 'Use um número como 78,4.');
    state.medidas.push({ id: uid(), data: f.data, peso, obs: texto(f.obs) });
  },
  'medida.excluir': ({ id }) => {
    if (!confirm('Excluir esta medida?')) return false;
    state.medidas = state.medidas.filter((m) => m.id !== id);
  },
});
