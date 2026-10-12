import { state, actions, abrir, fechar, dialogoAberto, aviso, invalido, uid, texto } from '../core.js';
import { html, attr, icon, topo, campo, resumo, vazio, dataCurta, dataMedia, n, compacto } from '../ui.js';
import { seletor, calendario } from '../widgets.js';
import { hoje, somaDias, inicioSemana, diaSemana, somaMacros, num } from '../logic.js';
import { tendencia, balancoDoDia, balancoDoPeriodo, chegadaNaMeta, gastoBase, ROTINAS } from '../analise.js';
import { reduzirFoto, analisarRefeicao } from '../gemini.js';
import { ultimasSemanas, kcalPorDia } from '../metricas.js';
import { barras, linha } from '../graficos.js';

const ABAS = { treino: 'Treino', comida: 'Alimentação', medidas: 'Peso' };
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const NOMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SEMANA = [1, 2, 3, 4, 5, 6, 0]; // segunda primeiro
const CONFIANCA = { baixa: 'baixa', media: 'média', alta: 'alta' };
const inteiro = (v) => Math.max(0, Math.round(num(v) || 0));
const macros = (m) => `P ${n(m.p)} g, C ${n(m.c)} g, G ${n(m.g)} g`;

// ---------- Treino ----------

let editandoDias = false; // mantém a lista de dias aberta enquanto a pessoa marca vários

function formTreino(t) {
  // Os treinos mais recentes viram atalhos de um toque, no lugar da lista de sugestões do navegador.
  const tipos = [...new Set([...state.treinos].sort((a, b) => b.data.localeCompare(a.data)).map((x) => x.tipo).filter(Boolean))].slice(0, 6);
  return html`
    <form class="dlg-corpo" data-act="treino.salvar" data-id="${t?.id || ''}">
      <div class="dupla">
        ${calendario('Data', 'data', t?.data || hoje(), { obrigatorio: true })}
        ${campo('Duração (min)', html`<input name="min" inputmode="numeric" value="${t?.min || ''}" autocomplete="off">`)}
      </div>
      ${campo('Treino', html`<input name="tipo" value="${t?.tipo || ''}" autocomplete="off" placeholder="Ex.: peito e tríceps…">`)}
      ${tipos.length > 0 && html`
        <div class="sugestoes" role="group" aria-label="Treinos recentes">
          ${tipos.map((x) => html`<button type="button" data-act="treino.tipo" data-texto="${x}">${x}</button>`)}
        </div>`}
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
  const semanas8 = ultimasSemanas(state, d, 8, dataCurta);

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
      ${resumo('Dias de treino planejados')}
      <div class="chips" role="group" aria-label="Dias de treino planejados">
        ${SEMANA.map((dia) => html`
          <label><input type="checkbox" value="${dia}" data-mudou="treino.dia" ${attr('checked', planejados.includes(dia))}><span>${NOMES[dia]}</span></label>`)}
      </div>
      <small>Treino só é esperado nesses dias. Fora deles, descanso é descanso.</small>
    </details>

    ${state.treinos.length > 0 && html`
      <section class="bloco">
        ${barras({
          ...semanas8,
          titulo: 'Treinos por semana',
          series: [{ nome: 'Treinos', valores: semanas8.serie.map((x) => x.treinos) }],
          meta: planejados.length > 0 && { valor: planejados.length, rotulo: `planejado ${planejados.length}` },
          vazio: 'Nenhum treino nas últimas 8 semanas.',
        })}
      </section>`}

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
      ${calendario('Data', 'data', r?.data || diaEscolhido || hoje(), { max: hoje(), obrigatorio: true })}
      ${r?.itens?.length > 0 && html`
        <section>
          <h3>Itens</h3>
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
  const dias = kcalPorDia(state, hoje(), 14);

  return html`
    <div class="barra">
      ${calendario('Dia', 'dia', d, { max: hoje(), obrigatorio: true, mudou: 'comida.dia', oculto: true })}
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
        ? vazio('Nada registrado neste dia. Tire uma foto do prato ou conte para a assistente o que comeu: a IA estima as calorias.')
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

    <section class="bloco">
      ${barras({
        titulo: 'Calorias nos últimos 14 dias',
        rotulos: dias.map((x) => x.data.slice(8)),
        longos: dias.map((x) => dataMedia(x.data)),
        series: [{ nome: 'Calorias', valores: dias.map((x) => x.kcal) }],
        formato: (v) => `${n(v)} kcal`,
        eixo: compacto,
        inteiro: false,
        meta: metaKcal > 0 && { valor: metaKcal, rotulo: `meta ${n(metaKcal)}` },
        destaque: 'hoje',
        vazio: 'Nenhuma refeição registrada nos últimos 14 dias.',
      })}
    </section>`;
}

// ---------- Medidas ----------

function medidas() {
  const ref = hoje();
  const s = state.settings;
  const lista = [...state.medidas].sort((a, b) => b.data.localeCompare(a.data));
  const [atual] = lista;
  const primeira = lista.at(-1);
  const delta = atual && primeira !== atual ? atual.peso - primeira.peso : null;
  const kg = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const grafico = lista.slice(0, 20).reverse(); // as 20 medidas mais recentes, em ordem de data

  // Balanço: o que o peso mostra na prática e o que os registros de comida e treino estimam.
  const t = tendencia(state.medidas, ref);
  const dia = balancoDoDia(state, ref);
  const q = balancoDoPeriodo(state, ref, 14);
  const chegada = chegadaNaMeta(t, s.metaPeso, ref);
  const perfil = gastoBase(s, 70) != null; // os dados do perfil estão preenchidos, com ou sem peso registrado
  const gastoRef = q.gasto ?? dia.gasto;
  const comSinal = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;

  return html`
    ${atual && html`
      <p class="placar-kcal">
        <b class="num">${kg(atual.peso)}</b>
        <span>kg${delta != null && html` · ${delta > 0 ? '+' : ''}${kg(delta)} kg desde ${dataCurta(primeira.data)}`}</span>
      </p>`}

    <form class="pilha" data-act="medida.salvar">
      <div class="dupla">
        ${calendario('Data', 'data', hoje(), { max: hoje(), obrigatorio: true })}
        ${campo('Peso (kg)', html`<input name="peso" required inputmode="decimal" autocomplete="off" placeholder="Ex.: 78,4…">`)}
      </div>
      ${campo('Observação', html`<input name="obs" autocomplete="off" placeholder="Ex.: em jejum, pela manhã…">`)}
      <div class="acoes"><button class="btn btn-p">Registrar peso</button></div>
    </form>
    <p class="nota">Registre quando fizer sentido. Uma vez por semana, no mesmo horário, já mostra a tendência.</p>

    <section class="bloco" aria-labelledby="h-balanco">
      <h2 id="h-balanco">Balanço: peso e calorias</h2>
      ${t
        ? html`
          <p class="achado"><b class="num">${comSinal(t.kgPorSemana)} kg</b> por semana</p>
          <p class="nota">Pelas ${t.medidas} medidas de ${dataCurta(t.de)} a ${dataCurta(t.ate)}. ${Math.abs(t.kcalPorDia) < 50
            ? 'Na prática, o peso está estável.'
            : t.kcalPorDia < 0
              ? `Na prática, você está em déficit de cerca de ${n(-t.kcalPorDia)} kcal por dia.`
              : `Na prática, está sobrando cerca de ${n(t.kcalPorDia)} kcal por dia.`}</p>`
        : html`<p class="nota">Com duas medidas de peso separadas por pelo menos uma semana, aqui aparece se você está perdendo ou ganhando na prática.</p>`}
      ${chegada && html`
        <p class="nota">${chegada.falta === 0
          ? `Você está na meta de ${kg(s.metaPeso)} kg.`
          : chegada.data
            ? `Faltam ${kg(Math.abs(chegada.falta))} kg para a meta de ${kg(s.metaPeso)} kg. Nesse ritmo, chega por volta de ${dataCurta(chegada.data)}.`
            : `Faltam ${kg(Math.abs(chegada.falta))} kg para a meta de ${kg(s.metaPeso)} kg, mas nesse ritmo o peso não chega lá.`}</p>`}
      ${t && t.kgPorSemana < -0.01 * t.atual && html`<p class="nota">Perder mais de 1% do peso por semana costuma custar músculo e disposição. Sem acompanhamento profissional, vale ir mais devagar.</p>`}

      ${perfil && q.saldo != null
        ? html`
          <dl class="stats">
            <div><dt>comeu por dia</dt><dd class="num">${n(q.comeu)}</dd></div>
            <div><dt>gastou por dia</dt><dd class="num">${n(q.gasto)}</dd></div>
            <div><dt>${q.saldo < 0 ? 'déficit por dia' : 'sobra por dia'}</dt><dd class="num">${n(Math.abs(q.saldo))}</dd></div>
          </dl>
          <p class="nota">Em kcal, pela média ${q.registrados === 1 ? 'do único dia' : `dos ${q.registrados} dias`} com refeição registrada nos últimos 14, sem contar hoje. O gasto soma repouso, rotina e treinos.</p>`
        : html`<p class="nota">${perfil
          ? 'Registre as refeições de um dia inteiro (pode ser contando para a assistente) e aqui aparece o saldo de calorias.'
          : 'Preencha o perfil abaixo e o app estima quanto você gasta por dia, para comparar com o que você come.'}</p>`}
      ${dia.gasto != null && html`
        <p class="nota">Hoje: ${dia.comeu != null ? `${n(dia.comeu)} kcal até agora` : 'nenhuma refeição registrada'}, para um gasto estimado de ${n(dia.gasto)} kcal${dia.treino > 0 ? ` (${n(dia.treino)} do treino)` : ''}.</p>`}
    </section>

    ${gastoRef != null && html`
      <section class="bloco">
        ${barras({
          titulo: 'Calorias e gasto nos últimos 14 dias',
          sub: 'Barra abaixo da linha tracejada é dia de déficit.',
          rotulos: q.dias.map((x) => x.data.slice(8)),
          longos: q.dias.map((x) => dataMedia(x.data)),
          series: [{ nome: 'Calorias', valores: q.dias.map((x) => x.comeu) }],
          formato: (v) => `${n(v)} kcal`,
          eixo: compacto,
          inteiro: false,
          meta: { valor: gastoRef, rotulo: `gasto ${n(gastoRef)}` },
          destaque: 'hoje',
          vazio: 'Nenhuma refeição registrada nos últimos 14 dias.',
        })}
      </section>`}

    <details class="bloco" ${attr('open', !perfil)}>
      ${resumo('Perfil para a conta de calorias')}
      <form class="pilha" data-act="corpo.perfil">
        <div class="dupla">
          ${seletor('Sexo (entra na fórmula)', 'sexo', { m: 'Masculino', f: 'Feminino' }, s.sexo, { vazio: 'Escolher' })}
          ${campo('Idade', html`<input name="idade" inputmode="numeric" autocomplete="off" value="${s.idade || ''}" placeholder="Ex.: 28…">`)}
        </div>
        <div class="dupla">
          ${campo('Altura (cm)', html`<input name="altura" inputmode="decimal" autocomplete="off" value="${s.altura || ''}" placeholder="Ex.: 178…">`)}
          ${campo('Meta de peso (kg)', html`<input name="metaPeso" inputmode="decimal" autocomplete="off" value="${s.metaPeso ? kg(s.metaPeso) : ''}" placeholder="Opcional…">`)}
        </div>
        ${seletor('Rotina fora do treino', 'rotina', ROTINAS, ROTINAS[s.rotina] ? s.rotina : 'sentado')}
        <div class="acoes"><button class="btn btn-p">Salvar perfil</button></div>
        <small>O gasto é uma estimativa (fórmula de Mifflin-St Jeor, rotina e duração dos treinos). Serve de referência, não de orientação médica ou nutricional.</small>
      </form>
    </details>

    ${lista.length > 1 && html`
      <section class="bloco">
        ${linha({
          titulo: 'Peso',
          sub: 'Um ponto por medida, da mais antiga para a mais recente. O eixo acompanha a faixa das medidas.',
          rotulos: grafico.map((m) => dataCurta(m.data)),
          longos: grafico.map((m) => dataMedia(m.data)),
          valores: grafico.map((m) => m.peso),
          nome: 'Peso',
          formato: (v) => `${kg(v)} kg`,
          eixo: n,
        })}
      </section>`}

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
  'treino.tipo': ({ texto: tipo }, botao) => {
    botao.closest('form').elements.tipo.value = tipo;
    return false;
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
  'corpo.perfil': (f, form) => {
    const idade = inteiro(f.idade);
    let altura = num(f.altura);
    if (altura > 0 && altura < 3) altura *= 100; // quem digita 1,78 quis dizer 178 cm
    altura = Math.round(altura || 0);
    const meta = texto(f.metaPeso) ? num(f.metaPeso) : 0;
    if (!['m', 'f'].includes(f.sexo)) return invalido(form.elements.sexo, 'Escolha uma opção.');
    if (!(idade >= 10 && idade <= 100)) return invalido(form.elements.idade, 'Idade em anos, como 28.');
    if (!(altura >= 100 && altura <= 230)) return invalido(form.elements.altura, 'Altura em centímetros, como 178.');
    if (!(meta >= 0 && meta < 400)) return invalido(form.elements.metaPeso, 'Use um número como 75.');
    Object.assign(state.settings, { sexo: f.sexo, idade, altura, rotina: ROTINAS[f.rotina] ? f.rotina : 'sentado', metaPeso: meta });
    aviso('Perfil salvo.');
  },
});
