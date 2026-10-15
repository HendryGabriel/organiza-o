import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../js/seed.js';
import { editarRegistro } from '../js/edicao.js';
import { periodoPronto, lerPeriodo } from '../js/periodos.js';
import { serieSemanal } from '../js/metricas.js';
import { fluxoDoIntervalo } from '../js/analise.js';

test('editar ação mantém id e sincroniza tarefa concluída sem duplicar XP', () => {
  const s = seed();
  s.tasks = [{ id: 't', titulo: 'Antes', area: 'pessoal', min: 5, feitaEm: '2026-10-14' }];
  s.feitos = [{ id: 'f', chave: 'task:t', titulo: 'Antes', area: 'pessoal', min: 5, data: '2026-10-14' }];
  assert.equal(editarRegistro(s, 'feitos', 'f', { titulo: 'Depois', area: 'clientes', min: '30', data: '2026-10-13' }), null);
  assert.equal(s.tasks[0].feitaEm, '2026-10-13');
  assert.equal(s.tasks[0].titulo, 'Depois');
  assert.equal(s.feitos.length, 1);
  assert.equal(s.feitos[0].id, 'f');
  editarRegistro(s, 'tasks', 't', { titulo: 'Final', area: 'produto', min: '40', prazo: '2026-10-15' });
  assert.equal(s.feitos[0].titulo, 'Final');
});

test('peso inválido não modifica a medida e correção preserva seu id', () => {
  const s = seed(); s.medidas = [{ id: 'm', peso: 80, data: '2026-10-14' }];
  assert.ok(editarRegistro(s, 'medidas', 'm', { peso: '-1' }));
  assert.equal(s.medidas[0].peso, 80);
  editarRegistro(s, 'medidas', 'm', { peso: '79,5', data: '2026-10-13', obs: 'Corrigido' });
  assert.equal(s.medidas[0].peso, 79.5);
  assert.equal(s.medidas.length, 1);
});

test('atalhos respeitam início de semana, mês anterior e datas inválidas', () => {
  assert.deepEqual(periodoPronto('7', '2026-10-14'), ['2026-10-08', '2026-10-14']);
  assert.deepEqual(periodoPronto('passada', '2026-10-14'), ['2026-10-05', '2026-10-11']);
  assert.deepEqual(periodoPronto('mesPassado', '2026-01-14'), ['2025-12-01', '2025-12-31']);
  assert.notEqual(lerPeriodo('2026-02-30|2026-03-01')[0], '2026-02-30');
});

test('semana parcial exclui registros fora das datas escolhidas', () => {
  const s = seed();
  s.feitos = [{ data: '2026-10-12', area: 'clientes', min: 20 }, { data: '2026-10-14', area: 'clientes', min: 30 }];
  const serie = serieSemanal(s, ['2026-10-12'], ['2026-10-14', '2026-10-14']);
  assert.equal(serie[0].negocio, 1);
  assert.equal(serie[0].minTotal, 30);
});

test('intervalo entre meses mantém cartão sem contagem dupla e exclui dias externos', () => {
  const lista = [
    { tipo: 'receita', categoria: 'salario', valor: 1000, data: '2026-09-01' },
    { tipo: 'receita', categoria: 'clientes', valor: 2000, data: '2026-09-30' },
    { tipo: 'custo', categoria: 'mercado', valor: 300, data: '2026-09-20', cartao: true, fatura: '2026-10' },
    { tipo: 'fatura', valor: 300, data: '2026-10-10' },
    { tipo: 'custo', categoria: 'transporte', valor: 100, data: '2026-10-14' },
  ];
  const f = fluxoDoIntervalo(lista, '2026-09-30', '2026-10-13');
  assert.equal(f.entrou, 2000);
  assert.equal(f.saiu, 300);
  assert.equal(f.sobra, 1700);
});
