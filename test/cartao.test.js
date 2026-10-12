// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { faturaDe, parcelar, proximasFaturas, fluxoDoMes } from '../js/analise.js';
import { lerOfx, lerCsv, comprasDaFatura, conferir, chaveDe, decodificar, classeValida, movimentosDaIA } from '../js/extrato.js';

const l = (tipo, valor, data, extra = {}) => ({ id: `${tipo}${valor}${data}${extra.fatura || ''}`, tipo, valor, data, ...extra });
const saidas = (f) => Object.fromEntries(f.saidas.map((s) => [s.chave, s.valor]));

test('cartão: a compra cai na fatura certa, pelo fechamento e pelo vencimento', () => {
  const fim = { cartaoFecha: 25, cartaoVence: 5 }; // fecha no fim do mês, vence no começo do seguinte
  assert.equal(faturaDe('2026-10-20', fim), '2026-11');
  assert.equal(faturaDe('2026-10-25', fim), '2026-12'); // no dia do fechamento já é a próxima
  assert.equal(faturaDe('2026-12-26', fim), '2027-02');
  const comeco = { cartaoFecha: 3, cartaoVence: 10 }; // fecha e vence no mesmo mês
  assert.equal(faturaDe('2026-10-02', comeco), '2026-10');
  assert.equal(faturaDe('2026-10-04', comeco), '2026-11');
  assert.equal(faturaDe('2026-10-20', {}), '2026-11'); // sem os dias cadastrados: mês seguinte
});

test('cartão: parcelas somam exatamente o valor da compra, uma por fatura', () => {
  assert.deepEqual(parcelar(60000, 3, '2026-11'), [
    { valor: 20000, fatura: '2026-11', parcela: '1/3' },
    { valor: 20000, fatura: '2026-12', parcela: '2/3' },
    { valor: 20000, fatura: '2027-01', parcela: '3/3' },
  ]);
  const quebrado = parcelar(10000, 3, '2026-11');
  assert.deepEqual(quebrado.map((p) => p.valor), [3334, 3333, 3333]);
  assert.equal(quebrado.reduce((t, p) => t + p.valor, 0), 10000);
  assert.deepEqual(parcelar(5000, 1, '2026-11'), [{ valor: 5000, fatura: '2026-11', parcela: '' }]);
});

test('cartão: pagamento da fatura e compras lançadas nunca contam em dobro', () => {
  const mercado = l('custo', 30000, '2026-10-03', { categoria: 'mercado' }); // no débito
  const fatura = l('fatura', 100000, '2026-10-05');
  const compra = (valor, data, fat, extra = {}) => l('custo', valor, data, { categoria: 'compras', cartao: true, fatura: fat, ...extra });

  // Só o pagamento: tudo vira "sem detalhe".
  let f = fluxoDoMes([mercado, fatura], '2026-10');
  assert.deepEqual(saidas(f), { cartao: 100000, mercado: 30000 });
  assert.equal(f.saiu, 130000);

  // Pagamento + parte das compras: o total do mês não muda, só ganha detalhe.
  f = fluxoDoMes([mercado, fatura, compra(40000, '2026-09-12', '2026-10'), compra(25000, '2026-09-20', '2026-10', { categoria: 'lazer' })], '2026-10');
  assert.deepEqual(saidas(f), { compras: 40000, cartao: 35000, mercado: 30000, lazer: 25000 });
  assert.equal(f.saiu, 130000);
  assert.deepEqual(f.cartao, { pago: 100000, detalhado: 65000, semDetalhe: 35000 });

  // Compras somam mais do que a fatura paga (ou a fatura ainda não foi lançada): vale a soma das compras, sem negativo.
  f = fluxoDoMes([compra(40000, '2026-09-12', '2026-10'), compra(70000, '2026-09-20', '2026-10'), fatura], '2026-10');
  assert.equal(f.saiu, 110000);
  assert.equal(f.cartao.semDetalhe, 0);

  // Compra de setembro paga em outubro não pesa em setembro. Parcelas pesam uma em cada mês.
  const lista = [compra(40000, '2026-09-12', '2026-10'), ...parcelar(60000, 3, '2026-10').map((p) => compra(p.valor, '2026-09-15', p.fatura, { parcela: p.parcela }))];
  assert.equal(fluxoDoMes(lista, '2026-09').saiu, 0);
  assert.equal(fluxoDoMes(lista, '2026-10').saiu, 60000);
  assert.equal(fluxoDoMes(lista, '2026-11').saiu, 20000);
  assert.deepEqual(proximasFaturas(lista, '2026-10'), [{ mes: '2026-11', valor: 20000 }, { mes: '2026-12', valor: 20000 }]);

  // Mês cortado no dia 4, com vencimento no dia 10: a fatura ainda não entrou na comparação.
  assert.equal(fluxoDoMes(lista, '2026-10', '04', 10).saiu, 0);
  assert.equal(fluxoDoMes(lista, '2026-10', '12', 10).saiu, 60000);
});

test('extrato: OFX e CSV são lidos pelo app, com sinal, centavos e data certos', () => {
  const ofx = `OFXHEADER:100\nCHARSET:1252\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261003120000[-3:BRT]<TRNAMT>-35.90<FITID>202610030001<MEMO>COMPRA CARTAO DEB  SUPERMERCADO SOL</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261005<TRNAMT>4000.00<FITID>202610050002<MEMO>FOLHA PAGAMENTO</STMTTRN>
<STMTTRN><TRNTYPE>OTHER<DTPOSTED>20261399<TRNAMT>10.00<FITID>x<MEMO>data impossível</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  const o = lerOfx(ofx);
  assert.equal(o.cartao, false);
  assert.deepEqual(o.movimentos, [
    { data: '2026-10-03', descricao: 'COMPRA CARTAO DEB SUPERMERCADO SOL', valor: -3590, id: '202610030001' },
    { data: '2026-10-05', descricao: 'FOLHA PAGAMENTO', valor: 400000, id: '202610050002' },
  ]);
  assert.equal(lerOfx('<CCSTMTRS><STMTTRN><DTPOSTED>20261003<TRNAMT>-10<MEMO>x</STMTTRN>').cartao, true);

  const csv = `Extrato de conta corrente;;;;\nAssociado: Fulano;Conta: 12345-6;;;\n"Data";"Descrição";"Documento";"Valor (R$)";"Saldo (R$)"\n03/10/2026;"PIX ENVIADO; PADARIA";123;-12,50;1.987,50\n05/10/2026;LIQUIDACAO BOLETO ALUGUEL;456;-1.200,00;787,50\n05/10/26;PIX RECEBIDO JOAO;789;350,00;1.137,50\n;SALDO ANTERIOR;;;2.000,00\n`;
  assert.deepEqual(lerCsv(csv).movimentos, [
    { data: '2026-10-03', descricao: 'PIX ENVIADO; PADARIA', valor: -1250, id: '' },
    { data: '2026-10-05', descricao: 'LIQUIDACAO BOLETO ALUGUEL', valor: -120000, id: '' },
    { data: '2026-10-05', descricao: 'PIX RECEBIDO JOAO', valor: 35000, id: '' },
  ]);
  // Colunas separadas de crédito e débito, com vírgula.
  assert.deepEqual(lerCsv('Data,Histórico,Crédito,Débito\n2026-10-03,Mercado,,"35,00"\n2026-10-04,Salário,"4.000,00",\n').movimentos.map((m) => m.valor), [-3500, 400000]);
  // Sem coluna de valor reconhecível, não chuta.
  assert.equal(lerCsv('Data;Descrição;Saldo\n03/10/2026;Mercado;100,00\n'), null);
  assert.equal(decodificar(new Uint8Array([0x61, 0xe7, 0xe3, 0x6f])), 'ação'); // Windows-1252
});

test('extrato: reimportar não duplica, e lançamento feito à mão é reconhecido', () => {
  const movs = [
    { data: '2026-10-03', descricao: 'SUPERMERCADO SOL', valor: -3590, id: 'a1' },
    { data: '2026-10-03', descricao: 'PADARIA', valor: -1250, id: '' },
    { data: '2026-10-03', descricao: 'PADARIA', valor: -1250, id: '' },
    { data: '2026-10-05', descricao: 'FOLHA', valor: 400000, id: 'a2' },
  ];
  const existentes = [
    { tipo: 'custo', valor: 3590, data: '2026-10-03', extrato: 'a1' }, // já veio de um extrato
    { tipo: 'custo', valor: 1250, data: '2026-10-04' }, // lançado à mão, um dia depois: explica UMA padaria
    { tipo: 'custo', valor: 400000, data: '2026-10-05' }, // mesmo valor, mas é saída: não é o salário
    { tipo: 'custo', valor: 1250, data: '2026-10-03', cartao: true, fatura: '2026-11' }, // compra no cartão não passa pela conta
  ];
  assert.deepEqual(conferir(movs, existentes).map((m) => m.repetido), ['importado', 'parecido', '', '']);
  assert.equal(chaveDe(movs[1]), '2026-10-03|-1250|PADARIA');

  // Fatura do cartão: o sinal das compras é o da maioria, e a comparação é com as compras daquela fatura.
  const fatura = [{ data: '2026-09-12', descricao: 'LOJA', valor: 20000, id: '' }, { data: '2026-09-20', descricao: 'POSTO', valor: 15000, id: '' }, { data: '2026-10-05', descricao: 'PAGAMENTO RECEBIDO', valor: -90000, id: '' }];
  const compras = comprasDaFatura(fatura);
  assert.deepEqual(compras.map((m) => m.valor), [-20000, -15000]);
  const noCartao = [{ tipo: 'custo', valor: 20000, data: '2026-08-12', cartao: true, fatura: '2026-10', parcela: '2/3' }, { tipo: 'custo', valor: 15000, data: '2026-09-20', cartao: true, fatura: '2026-11' }];
  assert.deepEqual(conferir(compras, noCartao, '2026-10').map((m) => m.repetido), ['parecido', '']);
});

test('extrato: o que a IA devolve não muda o sentido nem inventa data', () => {
  // O sentido vem do banco: entrada nunca vira gasto, saída nunca vira receita.
  assert.deepEqual(classeValida({ tipo: 'custo', categoria: 'mercado' }, false, false), { tipo: 'receita', categoria: 'extra' });
  assert.deepEqual(classeValida({ tipo: 'receita', categoria: 'salario' }, true, false), { tipo: 'custo', categoria: 'outros' });
  assert.deepEqual(classeValida({ tipo: 'fatura' }, true, false), { tipo: 'fatura', categoria: '' });
  assert.deepEqual(classeValida({ tipo: 'fatura', categoria: 'lazer' }, true, true), { tipo: 'custo', categoria: 'lazer' }); // em fatura, tudo é compra
  assert.deepEqual(classeValida({ tipo: 'custo', categoria: 'toString' }, true, false), { tipo: 'custo', categoria: 'outros' });
  assert.deepEqual(classeValida(null, false, false), { tipo: 'receita', categoria: 'extra' });

  const lido = movimentosDaIA({
    documento: 'cartao',
    vencimento: '05/11/2026',
    movimentos: [{ data: '2026-10-03', descricao: ' LOJA  X ', valor: 35.9, sentido: 'saida' }, { data: '31/02/2026', descricao: 'x', valor: 1, sentido: 'saida' }, { data: '2026-10-04', descricao: 'pix', valor: '10', sentido: 'entrada' }, { data: '2026-10-04', descricao: 'saldo', valor: 0, sentido: 'entrada' }],
  });
  assert.deepEqual(lido, { movimentos: [{ data: '2026-10-03', descricao: 'LOJA X', valor: -3590, id: '' }, { data: '2026-10-04', descricao: 'pix', valor: 1000, id: '' }], cartao: true, vencimento: '2026-11-05' });
  assert.deepEqual(movimentosDaIA('lixo'), { movimentos: [], cartao: false, vencimento: '' });
});
