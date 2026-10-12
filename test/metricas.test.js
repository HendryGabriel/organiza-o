// Rode com: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../js/seed.js';
import { semanasAte, serieSemanal, soma, kcalPorDia, funilDoPeriodo, teto } from '../js/metricas.js';

test('semanas: sempre segundas-feiras, da mais antiga para a atual', () => {
  assert.deepEqual(semanasAte('2026-10-14', 3), ['2026-09-28', '2026-10-05', '2026-10-12']);
  assert.deepEqual(semanasAte('2026-10-12', 1), ['2026-10-12']);
});

test('série semanal: cada registro cai na semana certa', () => {
  const s = seed();
  s.feitos.push(
    { data: '2026-10-12', area: 'clientes', min: 30 },
    { data: '2026-10-13', area: 'produto', min: 90 },
    { data: '2026-10-14', area: 'conteudo', min: 30 },
    { data: '2026-10-18', area: 'revisao', min: 5 },
    { data: '2026-10-19', area: 'clientes', min: 5 }, // semana seguinte
  );
  s.leads.push({ id: 'a', criadoEm: '2026-10-13' }, { id: 'b', criadoEm: '2026-10-20' });
  s.videos[0].pubs = { instagram: { data: '2026-10-14' }, tiktok: { data: '2026-10-14' } };
  s.treinos.push({ id: 't', data: '2026-10-15' }, { id: 'u', data: '2026-10-16' });
  s.refeicoes.push({ data: '2026-10-12', kcal: 2000, p: 0, c: 0, g: 0 }, { data: '2026-10-12', kcal: 400, p: 0, c: 0, g: 0 }, { data: '2026-10-13', kcal: 1800, p: 0, c: 0, g: 0 });
  s.medidas.push({ data: '2026-10-12', peso: 80 }, { data: '2026-10-17', peso: 79.5 });
  s.financas.push(
    { tipo: 'receita', valor: 100000, data: '2026-10-13', recebido: true },
    { tipo: 'custo', valor: 20000, data: '2026-10-14' },
    { tipo: 'imposto', valor: 5000, data: '2026-10-14' },
    { tipo: 'reserva', valor: 50000, data: '2026-10-15' },
    { tipo: 'reserva', valor: 10000, data: '2026-10-20' },
    { tipo: 'retirada', valor: 5000, data: '2026-10-21' },
  );

  const [antes, semana, depois] = serieSemanal(s, semanasAte('2026-10-20', 3));
  assert.equal(antes.ini, '2026-10-05');
  assert.deepEqual([antes.negocio, antes.conteudo, antes.outras, antes.reservado, antes.kcal, antes.peso], [0, 0, 0, 0, null, null]);

  assert.deepEqual([semana.negocio, semana.conteudo, semana.outras], [2, 1, 1]);
  assert.deepEqual([semana.minNegocio, semana.minConteudo], [120, 30]);
  assert.equal(semana.leads, 1);
  assert.equal(semana.videos, 1); // 2 posts, 1 vídeo
  assert.equal(semana.treinos, 2);
  assert.equal(semana.kcal, 2100); // (2400 + 1800) / 2 dias registrados
  assert.equal(semana.peso, 79.5); // a última medida da semana
  assert.deepEqual([semana.recebido, semana.custos, semana.reservado], [100000, 25000, 50000]);

  assert.equal(depois.negocio, 1);
  assert.equal(depois.reservado, 55000); // saldo acumulado: 50.000 + 10.000 - 5.000
  assert.equal(soma([antes, semana, depois], 'negocio'), 3);
});

test('calorias por dia: dia sem refeição não vira zero', () => {
  const s = seed();
  s.refeicoes.push({ data: '2026-10-11', kcal: 500, p: 0, c: 0, g: 0 }, { data: '2026-10-11', kcal: 700, p: 0, c: 0, g: 0 });
  assert.deepEqual(kcalPorDia(s, '2026-10-12', 3), [
    { data: '2026-10-10', kcal: null },
    { data: '2026-10-11', kcal: 1200 },
    { data: '2026-10-12', kcal: null },
  ]);
});

test('funil do período: só os leads criados na janela, com a base de cada taxa', () => {
  const leads = [
    { criadoEm: '2026-09-01', auge: 7, status: 'ganho' }, // antes da janela
    { criadoEm: '2026-10-12', auge: 0, status: 'pesquisado' },
    { criadoEm: '2026-10-12', auge: 2, status: 'abordado' },
    { criadoEm: '2026-10-13', auge: 3, status: 'respondeu' },
    { criadoEm: '2026-10-13', auge: 5, status: 'perdido' },
  ];
  const f = funilDoPeriodo(leads, '2026-10-12');
  assert.deepEqual(f.map((e) => e.valor), [4, 3, 2, 1, 0, 0]);
  assert.equal(f[0].taxa, null); // primeira etapa não tem taxa
  assert.equal(f[2].taxa, 2 / 3);
  assert.equal(f[2].deQue, 'abordados');
  assert.equal(f[5].taxa, null); // sem proposta, não existe taxa de fechamento
});

test('teto do eixo: sempre um número redondo que cabe o maior valor', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 7, 12, 45, 1250, 85000].map(teto), [1, 1, 2, 4, 5, 10, 20, 50, 2000, 100000]);
  assert.equal(teto(0.4), 0.4);
});
