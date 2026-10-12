// Importar o extrato da conta ou a fatura do cartão: o app lê datas e valores, a IA classifica,
// e nada vira lançamento antes de a pessoa conferir.
import { state, actions, abrir, fechar, dialogoAberto, aviso, uid } from '../core.js';
import { html, attr, icon, dataCurta, dinheiro } from '../ui.js';
import { seletor } from '../widgets.js';
import { hoje, somaDias, parseData, RENDAS, GASTOS } from '../logic.js';
import { mesDe, mesAntes } from '../analise.js';
import { decodificar, lerOfx, lerCsv, comprasDaFatura, conferir, chaveDe, classeValida } from '../extrato.js';
import { classificar, lerExtrato, config as gemini } from '../gemini.js';
import { emBase64 } from '../audio.js';

let lote = null; // extrato já lido e classificado, esperando a conferência: { cartao, fatura, itens }

const nomeDoMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
// Os meses em volta de um mês, para escolher em qual a fatura é paga.
export const mesesPerto = (centro, antes = 3, depois = 3) =>
  Object.fromEntries([...Array(antes + depois + 1)].map((_, i) => {
    const m = mesAntes(centro, antes - i);
    return [m, nomeDoMes.format(parseData(`${m}-15`))];
  }));

const esperando = (msg) =>
  abrir('Importar extrato', html`<div class="dlg-corpo importando"><div class="esqueleto" role="status"><p>${msg}</p><i></i><i></i><i></i></div></div>`);

function escolherArquivo() {
  abrir('Importar extrato', html`
    <form class="dlg-corpo">
      ${seletor('O arquivo é', 'origem', { conta: 'Extrato da conta', cartao: 'Fatura do cartão de crédito' }, 'conta')}
      ${seletor('Se for fatura, ela é paga em', 'fatura', mesesPerto(mesDe(hoje())), mesDe(hoje()))}
      <label class="btn btn-p">${icon('upload-simple')} Escolher o arquivo<input class="sr" type="file" accept=".ofx,.csv,.txt,.pdf,application/pdf,text/csv" data-mudou="extrato.arquivo"></label>
      <small>Aceita OFX, CSV e PDF. No Sicredi, abra o extrato, escolha o período e use exportar ou compartilhar. Em OFX e CSV o app lê datas e valores sozinho, e só as descrições vão para a IA classificar. Em PDF o arquivo inteiro vai para o Gemini: confira os valores com mais atenção.</small>
      ${!gemini().key && html`<small>Sem a chave do Gemini, OFX e CSV entram sem categoria (como Outros e Renda extra) e PDF não é lido.</small>`}
    </form>`);
}

const rotulo = (m) =>
  ({ ignorar: 'Fora da conta: transferência, aplicação ou estorno', fatura: 'Pagamento da fatura do cartão', imposto: 'Imposto' })[m.tipo] ||
  (m.tipo === 'custo' ? `Gasto, ${GASTOS[m.categoria]}` : `Receita, ${RENDAS[m.categoria]}`);
const REPETIDO = { importado: 'já importado', parecido: 'parece um lançamento que já existe' };

function conferencia() {
  const { itens, cartao, fatura } = lote;
  const datas = itens.map((m) => m.data).sort();
  const marcado = (m) => !m.repetido && m.tipo !== 'ignorar';
  abrir('Confira o extrato', html`
    <form class="dlg-corpo" data-act="extrato.importar">
      <p>${itens.length} ${itens.length === 1 ? 'movimentação' : 'movimentações'}, de ${dataCurta(datas[0])} a ${dataCurta(datas.at(-1))}. ${itens.filter(marcado).length} ${itens.filter(marcado).length === 1 ? 'marcada' : 'marcadas'} para lançar.</p>
      ${cartao && seletor('Fatura paga em', 'fatura', { ...mesesPerto(mesDe(hoje())), ...mesesPerto(fatura, 0, 0) }, fatura)}
      <fieldset class="grupo itens">
        <legend>Vou lançar</legend>
        ${itens.map((m, i) => html`
          <label class="item">
            <input type="checkbox" name="item" value="${i}" ${attr('checked', marcado(m))} ${attr('disabled', m.repetido === 'importado')}>
            <span><b>${m.descricao || 'Sem descrição'}</b><small>${dataCurta(m.data)} · ${rotulo(m)}${m.repetido && html` · ${REPETIDO[m.repetido]}`}</small></span>
            <span class="num">${m.valor < 0 ? '-' : '+'}${dinheiro(Math.abs(m.valor))}</span>
          </label>`)}
      </fieldset>
      <small>Datas e valores vieram do arquivo; a categoria foi sugerida pela IA e pode ser corrigida depois em Lançamentos. O que está desmarcado não entra.</small>
      <footer class="dlg-acoes fixo">
        <button type="button" class="btn btn-t" data-act="extrato.descartar">Descartar</button>
        <button class="btn btn-p">Lançar os marcados</button>
      </footer>
    </form>`);
}

async function ler(arquivo, opcoes) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const temChave = Boolean(gemini().key);
  let lido;
  if (arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name)) {
    if (!temChave) throw new Error('Para ler PDF, cole a chave do Gemini em Configurações. Sem ela, exporte o extrato em OFX ou CSV.');
    esperando('A IA está lendo o PDF. Pode levar um minuto…');
    lido = await lerExtrato({ pdf: emBase64(bytes) });
  } else {
    const texto = decodificar(bytes);
    lido = /<STMTTRN>/i.test(texto) ? lerOfx(texto) : lerCsv(texto);
    if (!lido) {
      if (!temChave) throw new Error('Não reconheci as colunas desse arquivo. Tente exportar em OFX.');
      esperando('Não reconheci as colunas. A IA está lendo o arquivo…');
      lido = await lerExtrato({ texto });
    }
  }
  // A escolha da pessoa vale; o arquivo só desempata quando ele mesmo diz que é fatura de cartão.
  const cartao = opcoes.origem === 'cartao' || lido.cartao;
  const limite = somaDias(hoje(), -5 * 366);
  const movimentos = (cartao ? comprasDaFatura(lido.movimentos) : lido.movimentos).filter((m) => m.data <= hoje() && m.data >= limite);
  if (movimentos.length === 0) throw new Error('Não encontrei movimentações nesse arquivo.');
  esperando(`Classificando ${movimentos.length} movimentações…`);
  const classes = temChave
    ? await classificar(movimentos, cartao, (feitas, total) => dialogoAberto() && document.querySelector('#dlg .importando') && esperando(`Classificando… ${feitas} de ${total} descrições`))
    : movimentos.map((m) => classeValida(null, m.valor < 0, cartao));
  const fatura = cartao ? (lido.vencimento ? mesDe(lido.vencimento) : opcoes.fatura) : '';
  return { cartao, fatura, itens: conferir(movimentos, state.financas, fatura).map((m, i) => ({ ...m, ...classes[i] })) };
}

Object.assign(actions, {
  'extrato.abrir': () => {
    if (lote) conferencia();
    else escolherArquivo();
    return false;
  },

  'extrato.arquivo': async (_, entrada) => {
    const arquivo = entrada.files[0];
    const opcoes = Object.fromEntries(new FormData(entrada.form));
    entrada.value = '';
    if (!arquivo) return false;
    if (arquivo.size > 15e6) return aviso('Arquivo grande demais. O limite é 15 MB.'), false;
    esperando('Lendo o arquivo…');
    try {
      lote = await ler(arquivo, opcoes);
    } catch (e) {
      if (document.querySelector('#dlg .importando')) {
        abrir('Importar extrato', html`
          <div class="dlg-corpo">
            <p class="erro" role="alert">${e.message}</p>
            <footer class="dlg-acoes"><button class="btn btn-p" data-act="extrato.abrir">Escolher outro arquivo</button></footer>
          </div>`);
      } else aviso(e.message);
      return false;
    }
    // Se a pessoa fechou a tela de espera, o extrato lido fica guardado: abre na próxima vez.
    if (document.querySelector('#dlg .importando')) conferencia();
    else aviso('Extrato lido. Abra “Importar extrato” para conferir.');
    return false;
  },

  'extrato.descartar': () => {
    lote = null;
    fechar();
    return false;
  },

  'extrato.importar': (f, form) => {
    const fatura = /^\d{4}-\d{2}$/.test(f.fatura) ? f.fatura : lote.fatura;
    const ids = [];
    for (const i of new FormData(form).getAll('item')) {
      const m = lote.itens[i];
      if (!m || m.repetido === 'importado') continue;
      // O que a IA mandou ignorar e a pessoa marcou mesmo assim entra pelo sentido: saída é gasto, entrada é receita.
      const { tipo, categoria } = m.tipo === 'ignorar' ? classeValida(null, m.valor < 0, lote.cartao) : m;
      const id = uid();
      state.financas.push({ id, tipo, categoria, valor: Math.abs(m.valor), data: m.data, descricao: m.descricao, cliente: '', recebido: true, extrato: chaveDe(m), ...(lote.cartao && { cartao: true, fatura }) });
      ids.push(id);
    }
    if (ids.length === 0) return aviso('Marque pelo menos uma movimentação.'), false;
    lote = null;
    fechar();
    aviso(`${ids.length} ${ids.length === 1 ? 'lançamento importado' : 'lançamentos importados'}.`, () => {
      state.financas = state.financas.filter((l) => !ids.includes(l.id));
    });
  },
});
