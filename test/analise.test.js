// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../js/seed.js';
import { fluxoDoMes, economia, mesAntes, prospeccaoEmDinheiro, gastoBase, gastoDoTreino, balancoDoDia, balancoDoPeriodo, tendenciaDoPeso, chegadaNaMeta, contextoDaAssistente, resumoDosLembretes } from '../js/analise.js';

const l = (tipo, valor, data, extra = {}) => ({ id: `${tipo}${valor}${data}`, tipo, valor, data, ...extra });

test('mês: de onde entrou, para onde saiu e quanto sobrou', () => {
  const f = fluxoDoMes(
    [
      l('receita', 400000, '2026-10-05', { categoria: 'salario' }),
      l('receita', 150000, '2026-10-08'), // sem categoria: cliente do negócio
      l('receita', 90000, '2026-10-09', { recebido: false }), // a receber não é dinheiro
      l('custo', 120000, '2026-10-01', { categoria: 'moradia' }),
      l('custo', 30000, '2026-10-03', { categoria: 'comer_fora' }),
      l('custo', 32000, '2026-10-10', { categoria: 'comer_fora' }),
      l('imposto', 9000, '2026-10-10'),
      l('reserva', 50000, '2026-10-11'),
      l('custo', 99999, '2026-09-30', { categoria: 'lazer' }), // outro mês
    ],
    '2026-10',
  );
  assert.deepEqual(f.entradas.map((x) => [x.nome, x.valor]), [['Salário', 400000], ['Clientes', 150000]]);
  assert.deepEqual(f.saidas.map((x) => [x.nome, x.valor]), [['Moradia', 120000], ['Comer fora', 62000], ['Impostos', 9000]]);
  assert.equal(f.sobra, 550000 - 191000);
  assert.equal(f.guardado, 50000);
  assert.equal(mesAntes('2026-01'), '2025-12');
});

test('onde economizar: só gasto variável, comparado com o mesmo trecho dos meses anteriores', () => {
  const lanc = [
    l('custo', 50000, '2026-10-04', { categoria: 'comer_fora' }),
    l('custo', 20000, '2026-10-06', { categoria: 'lazer' }),
    l('custo', 150000, '2026-10-01', { categoria: 'moradia' }),
    l('custo', 30000, '2026-09-05', { categoria: 'comer_fora' }),
    l('custo', 70000, '2026-09-25', { categoria: 'comer_fora' }), // depois do dia 12: fora da comparação
    l('custo', 10000, '2026-08-02', { categoria: 'comer_fora' }),
  ];
  const e = economia(lanc, '2026-10', '2026-10-12');
  assert.deepEqual(e.linhas.map((x) => x.chave), ['comer_fora', 'lazer']); // moradia não entra
  assert.equal(e.meses, 2); // julho não tem lançamento: não puxa a média para baixo
  assert.equal(e.linhas[0].media, 20000);
  assert.equal(e.linhas[0].acima, 30000);
  assert.equal(e.corte10, 7000);
  assert.equal(economia(lanc, '2026-09', '2026-10-12').parcial, false);
});

test('prospecção em dinheiro: sem cliente fechado não existe valor por abordagem', () => {
  const s = seed();
  const lead = (status, auge, primeira) => ({ empresa: status, status, auge, atividades: primeira ? [{ data: primeira }] : [] });
  s.leads = [lead('pesquisado', 0), lead('abordado', 2, '2026-10-10'), lead('abordado', 2, '2026-10-01'), lead('respondeu', 3, '2026-08-01'), lead('sem_resposta', 2, '2026-10-05')];
  let p = prospeccaoEmDinheiro(s, '2026-10-12');
  assert.equal(p.porAbordagem, null);
  assert.equal(p.novasPorSemana, 0.75);
  // Quem respondeu não chegou à demo: é ali que o funil vaza mais.
  assert.equal(p.gargalo.nome, 'Da resposta para a demo');

  s.leads.push({ empresa: 'Fechou', status: 'ganho', auge: 7, atividades: [{ data: '2026-09-01' }] });
  s.financas = [l('receita', 200000, '2026-10-02'), l('receita', 900000, '2026-10-05', { categoria: 'salario' })];
  p = prospeccaoEmDinheiro(s, '2026-10-12');
  assert.equal(p.ticket, 200000); // salário não é receita de cliente
  assert.equal(p.porAbordagem, 40000); // 5 abordados
  assert.equal(p.abordagensPorCliente, 5);
  assert.equal(p.porMesNoRitmo, Math.round(0.75 * (52 / 12) * 40000));
});

test('balanço de calorias: gasto estimado só com perfil, e treino soma só o que acrescenta', () => {
  const perfil = { sexo: 'm', idade: 30, altura: 180, rotina: 'sentado' };
  assert.equal(gastoBase(perfil, 80), Math.round((800 + 1125 - 150 + 5) * 1.2));
  assert.equal(gastoBase({ ...perfil, sexo: '' }, 80), null);
  assert.equal(gastoDoTreino({ tipo: 'Perna', min: 60 }, 80), 280);
  assert.equal(gastoDoTreino({ tipo: 'Corrida leve', min: 30 }, 80), 280);
  assert.equal(gastoDoTreino({ tipo: 'Perna', min: 0 }, 80), 0);

  const s = seed();
  Object.assign(s.settings, perfil);
  s.medidas = [{ data: '2026-10-01', peso: 80 }];
  s.treinos = [{ data: '2026-10-10', tipo: 'Perna', min: 60 }];
  s.refeicoes = [{ data: '2026-10-10', kcal: 1900, p: 0, c: 0, g: 0 }, { data: '2026-10-11', kcal: 2500, p: 0, c: 0, g: 0 }, { data: '2026-10-12', kcal: 600, p: 0, c: 0, g: 0 }];
  const dia = balancoDoDia(s, '2026-10-10');
  assert.deepEqual([dia.comeu, dia.base, dia.treino, dia.saldo], [1900, 2136, 280, 1900 - 2416]);
  assert.equal(balancoDoDia(s, '2026-10-09').saldo, null); // dia sem refeição não vira déficit

  const p = balancoDoPeriodo(s, '2026-10-12', 14);
  assert.equal(p.registrados, 2); // hoje ainda está em andamento
  assert.equal(p.comeu, 2200);
  assert.equal(p.saldo, Math.round((1900 - 2416 + 2500 - 2136) / 2));
});

test('tendência do peso: precisa de medidas com uma semana entre elas', () => {
  const medidas = [{ data: '2026-09-20', peso: 82 }, { data: '2026-09-27', peso: 81.5 }, { data: '2026-10-04', peso: 81 }, { data: '2026-10-11', peso: 80.5 }];
  const t = tendenciaDoPeso(medidas, '2026-10-12');
  assert.ok(Math.abs(t.kgPorSemana + 0.5) < 1e-9);
  assert.equal(t.kcalPorDia, -550);
  assert.equal(tendenciaDoPeso(medidas.slice(2, 3), '2026-10-12'), null);
  assert.equal(tendenciaDoPeso([{ data: '2026-10-10', peso: 81 }, { data: '2026-10-12', peso: 80 }], '2026-10-12'), null);

  const meta = chegadaNaMeta(t, 78, '2026-10-12');
  assert.equal(meta.semanas, 5);
  assert.equal(meta.data, '2026-11-16');
  assert.equal(chegadaNaMeta(t, 85, '2026-10-12').data, null); // o peso está indo para o outro lado
  assert.equal(chegadaNaMeta(null, 78, '2026-10-12'), null);
});

test('assistente e lembretes: o resumo sai dos registros, em reais e sem inventar', () => {
  const s = seed();
  s.financas = [l('receita', 400000, '2026-10-05', { categoria: 'salario' }), l('custo', 62000, '2026-10-06', { categoria: 'comer_fora', descricao: 'iFood' })];
  s.leads = [{ id: 'a', empresa: 'Escritório Silva', status: 'abordado', auge: 2, followUp: '2026-10-12', atividades: [] }, { id: 'b', empresa: 'Fechado', status: 'perdido', followUp: '2026-10-01', atividades: [] }];
  s.tasks = [{ id: 't', titulo: 'Enviar proposta', prazo: '2026-10-14', min: 30, area: 'clientes' }];
  s.settings.diasTreino = [1]; // segunda
  const c = contextoDaAssistente(s, '2026-10-12');
  assert.equal(c.diaDaSemana, 'segunda-feira');
  assert.deepEqual(c.dinheiroDoMes.entrouPorFonte, { Salário: 4000 });
  assert.deepEqual(c.dinheiroDoMes.saiuPorCategoria, { 'Comer fora': 620 });
  assert.equal(c.dinheiroDoMes.sobrou, 3380);
  assert.equal(c.negocio.recebidoDeClientes, 0);
  assert.deepEqual(c.prospeccao.followUpsVencidos, ['Escritório Silva']);
  assert.equal(c.corpo.perfilPreenchido, false);
  assert.equal(c.corpo.pesoAtual, null);
  const { sobreHendry, ...numeros } = c;
  assert.ok(JSON.stringify(numeros).length < 6000);
  assert.ok(sobreHendry.identidade.includes('Hendry'));

  const r = resumoDosLembretes(s, '2026-10-12');
  assert.deepEqual(r.dias['2026-10-12'].followUps, ['Escritório Silva']);
  assert.equal(r.dias['2026-10-12'].treino, true);
  assert.equal(r.dias['2026-10-13'].treino, false);
  assert.deepEqual(r.dias['2026-10-14'].prazos, ['Enviar proposta']);
  assert.equal(r.ultimoRegistro, '');
});
