// Leitura de extrato bancário e de fatura de cartão. Regras puras, para rodar também em `node --test`.
// Valores e datas são lidos aqui, pelo próprio app: a IA só entra para classificar (e para ler PDF, que não tem outro jeito).
import { iso, parseData, num, RENDAS, GASTOS } from './logic.js?v=6';

const dataValida = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && iso(parseData(v)) === v;
// "12/10/2026", "12/10/26" ou "2026-10-12" -> "2026-10-12"
function paraIso(txt) {
  const t = String(txt).trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/);
  const v = br ? `${br[3].length === 2 ? `20${br[3]}` : br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : t.slice(0, 10);
  return dataValida(v) ? v : '';
}

// Texto de arquivo de banco costuma vir em Windows-1252, não em UTF-8.
export function decodificar(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

// OFX: cada <STMTTRN> é uma movimentação. Valor negativo é saída. FITID é o identificador que o banco dá.
export function lerOfx(texto) {
  const movimentos = texto
    .split(/<STMTTRN>/i)
    .slice(1)
    .map((bloco) => {
      const campo = (nome) => (bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i'))?.[1] || '').trim();
      const d = campo('DTPOSTED');
      return {
        data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
        descricao: (campo('MEMO') || campo('NAME')).replace(/\s+/g, ' ').slice(0, 120),
        valor: Math.round(Number(campo('TRNAMT').replace(',', '.')) * 100),
        id: campo('FITID'),
      };
    })
    .filter((m) => dataValida(m.data) && Number.isFinite(m.valor) && m.valor !== 0);
  return { movimentos, cartao: /<CCSTMTRS>|<CREDITCARDMSGSRSV1>/i.test(texto) };
}

// Uma linha de CSV em células, respeitando aspas (o separador pode aparecer dentro de um texto entre aspas).
function celulas(linha, sep) {
  const saida = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') atual += '"', i++;
      else aspas = !aspas;
    } else if (c === sep && !aspas) {
      saida.push(atual.trim());
      atual = '';
    } else atual += c;
  }
  return [...saida, atual.trim()];
}

// CSV: procura a linha de cabeçalho (tem "data" e uma coluna de valor) e lê as de baixo.
// Devolve null quando não reconhece as colunas: melhor pedir ajuda à IA do que ler o saldo como se fosse valor.
export function lerCsv(texto) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  for (const sep of [';', '\t', ',']) {
    for (let i = 0; i < Math.min(linhas.length, 40); i++) {
      const cab = celulas(linhas[i], sep).map((c) => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
      const col = (re, fora) => cab.findIndex((c) => re.test(c) && !fora?.test(c));
      const data = col(/^data/);
      const desc = col(/descri|historico|lancamento|estabelecimento|titulo/, /^data/);
      const valor = col(/valor/, /saldo/);
      const credito = col(/credito|entrada/);
      const debito = col(/debito|saida/);
      if (data < 0 || desc < 0 || (valor < 0 && (credito < 0 || debito < 0))) continue;
      const movimentos = linhas
        .slice(i + 1)
        .map((l) => celulas(l, sep))
        .map((c) => {
          const v = valor >= 0 ? num(c[valor]) : (num(c[credito]) || 0) - Math.abs(num(c[debito]) || 0);
          return { data: paraIso(c[data] || ''), descricao: (c[desc] || '').replace(/\s+/g, ' ').slice(0, 120), valor: Math.round(v * 100), id: '' };
        })
        .filter((m) => m.data && Number.isFinite(m.valor) && m.valor !== 0 && !/^saldo/i.test(m.descricao));
      if (movimentos.length > 0) return { movimentos, cartao: false };
    }
  }
  return null;
}

// Em fatura de cartão o sinal da compra muda de banco para banco. Compra é o lado que tem mais linhas:
// uma fatura tem muitas compras e um ou dois pagamentos ou estornos.
export function comprasDaFatura(movimentos) {
  const negativos = movimentos.filter((m) => m.valor < 0).length;
  const sinal = negativos > movimentos.length - negativos ? -1 : 1;
  return movimentos.filter((m) => Math.sign(m.valor) === sinal).map((m) => ({ ...m, valor: -Math.abs(m.valor) }));
}

// Identidade de uma movimentação: o FITID do banco quando existe; senão data, valor e descrição.
export const chaveDe = (m) => m.id || `${m.data}|${m.valor}|${m.descricao}`;

// Marca o que não deve entrar de novo: o que já veio de um extrato (mesma chave) e o que parece ser um
// lançamento feito à mão ou pela assistente (mesmo valor e mesmo sentido, com até 1 dia de diferença).
// Cada lançamento existente só "explica" uma movimentação, para dois gastos iguais no mesmo dia não se anularem.
// Com `fatura` (AAAA-MM), a comparação é com as compras de cartão lançadas naquela fatura; sem ela, com o que passou pela conta.
export function conferir(movimentos, lancamentos, fatura = '') {
  const importadas = new Set(lancamentos.map((l) => l.extrato).filter(Boolean));
  const livres = lancamentos.filter((l) => !l.extrato && (fatura ? l.cartao && l.fatura === fatura : !l.cartao));
  const usados = new Set();
  const saida = (l) => l.tipo !== 'receita' && l.tipo !== 'retirada';
  // Na fatura, a data impressa de uma parcela varia de banco para banco: basta ser a mesma fatura e o mesmo valor.
  const perto = (a, b) => Boolean(fatura) || Math.abs(parseData(a) - parseData(b)) <= 864e5 * 1.5;
  return movimentos.map((m) => {
    if (importadas.has(chaveDe(m))) return { ...m, repetido: 'importado' };
    const igual = livres.find((l) => !usados.has(l) && l.valor === Math.abs(m.valor) && saida(l) === m.valor < 0 && perto(l.data, m.data));
    if (igual) usados.add(igual);
    return { ...m, repetido: igual ? 'parecido' : '' };
  });
}

// ---------- O que a IA devolve é entrada externa ----------

// Classe de uma movimentação. O sentido vem do banco e manda: entrada nunca vira gasto, saída nunca vira receita.
export function classeValida(c, saida, cartao) {
  const gasto = () => ({ tipo: 'custo', categoria: Object.hasOwn(GASTOS, c?.categoria) ? c.categoria : 'outros' });
  if (cartao) return gasto();
  if (c?.tipo === 'ignorar') return { tipo: 'ignorar', categoria: '' };
  if (!saida) return { tipo: 'receita', categoria: Object.hasOwn(RENDAS, c?.categoria) ? c.categoria : 'extra' };
  return c?.tipo === 'imposto' || c?.tipo === 'fatura' ? { tipo: c.tipo, categoria: '' } : gasto();
}

// Movimentações que a IA leu de um PDF: só entram as que têm data real e valor plausível.
export function movimentosDaIA(obj) {
  const movimentos = (Array.isArray(obj?.movimentos) ? obj.movimentos : [])
    .map((m) => {
      const valor = Math.round(Math.abs(Number(m?.valor) || 0) * 100);
      return { data: paraIso(m?.data || ''), descricao: String(m?.descricao || '').replace(/\s+/g, ' ').trim().slice(0, 120), valor: m?.sentido === 'entrada' ? valor : -valor, id: '' };
    })
    .filter((m) => m.data && m.valor !== 0 && Math.abs(m.valor) <= 1e9);
  return { movimentos, cartao: obj?.documento === 'cartao', vencimento: paraIso(obj?.vencimento || '') };
}
