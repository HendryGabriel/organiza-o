// Rode com: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../js/seed.js';
import { retrato, carimbar, mesclar, paraNuvem, valido, darIds } from '../js/mescla.js';

const texto = (s) => JSON.stringify(paraNuvem(s));
const copia = (s) => structuredClone(s);

// Um aparelho de mentira: estado, retrato do último salvamento e um relógio próprio.
function aparelho(estado = seed()) {
  const a = { s: estado, ant: retrato(estado) };
  a.salvar = (agora) => {
    const r = carimbar(a.s, a.ant, agora);
    a.ant = r.retrato;
    return r.mudou;
  };
  // Mesmo ciclo do app: baixa, junta, aplica o que veio e envia se a nuvem ficou diferente.
  a.sincronizar = (nuvem) => {
    if (nuvem.dados) {
      a.s = mesclar(a.s, copia(nuvem.dados));
      a.ant = retrato(a.s);
    }
    if (!nuvem.dados || texto(a.s) !== JSON.stringify(nuvem.dados)) nuvem.dados = JSON.parse(texto(a.s));
  };
  return a;
}

test('carimbar: marca só o que mudou e anota o que foi apagado', () => {
  const a = aparelho();
  assert.equal(a.salvar(100), false); // nada mudou
  a.s.leads.push({ id: 'l1', empresa: 'A' });
  a.s.settings.metaKcal = 2400;
  a.s.dias['2026-10-12'] = { modo: 30 };
  a.s.timer = { chave: 'x', inicio: 1 }; // cronômetro é local: não conta como mudança
  assert.equal(a.salvar(200), true);
  assert.equal(a.s.leads[0].mod, 200);
  assert.equal(a.s.settings.mod, 200);
  assert.equal(a.s.dias['2026-10-12'].mod, 200);
  assert.equal(a.s.videos[0].mod, undefined); // intocado

  a.s.leads[0].empresa = 'B';
  a.s.videos = a.s.videos.filter((v) => v.id !== 'pauta-lancer-0');
  assert.equal(a.salvar(300), true);
  assert.equal(a.s.leads[0].mod, 300);
  assert.equal(a.s.apagados['videos:pauta-lancer-0'], 300);
  assert.equal(a.salvar(400), false); // carimbar não conta como mudança de conteúdo
});

test('mesclar: junta o que cada aparelho criou e o mais recente vence', () => {
  const [cel, pc] = [aparelho(), aparelho()];
  cel.s.refeicoes.push({ id: 'r1', nome: 'Almoço', kcal: 700 });
  cel.s.leads.push({ id: 'l1', empresa: 'Versão do celular' });
  cel.salvar(100);
  pc.s.treinos.push({ id: 't1', tipo: 'Perna' });
  pc.s.leads.push({ id: 'l1', empresa: 'Versão do computador' });
  pc.salvar(200);

  const a = mesclar(cel.s, pc.s);
  const b = mesclar(pc.s, cel.s);
  assert.equal(texto(a), texto(b)); // a ordem de quem junta com quem não importa
  assert.equal(a.refeicoes.length, 1);
  assert.equal(a.treinos.length, 1);
  assert.equal(a.leads[0].empresa, 'Versão do computador'); // mudou por último
  assert.equal(texto(mesclar(a, b)), texto(a)); // juntar de novo não muda nada
});

test('mesclar: apagar vale contra edição antiga, e edição nova traz o registro de volta', () => {
  const [cel, pc] = [aparelho(), aparelho()];
  cel.s.leads.push({ id: 'l1', empresa: 'A' }, { id: 'l2', empresa: 'B' });
  cel.salvar(100);
  pc.s = mesclar(pc.s, cel.s);
  pc.ant = retrato(pc.s);

  pc.s.leads = pc.s.leads.filter((l) => l.id !== 'l1'); // computador apaga l1 e l2 no instante 200
  pc.s.leads = pc.s.leads.filter((l) => l.id !== 'l2');
  pc.salvar(200);
  cel.s.leads.find((l) => l.id === 'l1').empresa = 'A editado antes'; // celular edita l1 em 150 e l2 em 300
  cel.salvar(150);
  cel.s.leads.find((l) => l.id === 'l2').empresa = 'B editado depois';
  cel.salvar(300);

  const junto = mesclar(cel.s, pc.s);
  assert.deepEqual(junto.leads.map((l) => l.empresa), ['B editado depois']);
  assert.equal(texto(junto), texto(mesclar(pc.s, cel.s)));
});

test('dois aparelhos sem internet ao mesmo tempo: ninguém perde nada', () => {
  const nuvem = {};
  const [cel, pc] = [aparelho(), aparelho()];
  pc.s.leads.push({ id: 'l1', empresa: 'Escritório' });
  pc.salvar(100);
  pc.sincronizar(nuvem);
  cel.sincronizar(nuvem);
  assert.equal(cel.s.leads.length, 1);

  // Academia sem sinal: o celular registra treino e refeição e não consegue enviar.
  cel.s.treinos.push({ id: 't1', tipo: 'Peito' });
  cel.s.refeicoes.push({ id: 'r1', nome: 'Pós-treino', kcal: 500 });
  cel.s.dias['2026-10-12'] = { modo: 5 };
  cel.salvar(200);
  // Em casa, antes de abrir o app no celular, o computador mexe em outras coisas e envia.
  pc.s.leads[0].status = 'abordado';
  pc.s.financas.push({ id: 'f1', tipo: 'receita', valor: 69700 });
  pc.s.rotina[1].t5 = 'Editado no computador';
  pc.salvar(300);
  pc.sincronizar(nuvem);

  cel.sincronizar(nuvem); // o celular volta: recebe o que veio e envia o que tinha guardado
  pc.sincronizar(nuvem);
  assert.equal(texto(cel.s), texto(pc.s));
  for (const a of [cel, pc]) {
    assert.equal(a.s.treinos.length, 1);
    assert.equal(a.s.refeicoes.length, 1);
    assert.equal(a.s.financas.length, 1);
    assert.equal(a.s.leads[0].status, 'abordado');
    assert.equal(a.s.rotina[1].t5, 'Editado no computador');
    assert.equal(a.s.dias['2026-10-12'].modo, 5);
  }
  // Depois de sincronizar, nada fica marcado como mudança pendente.
  assert.equal(cel.salvar(400), false);
  assert.equal(pc.salvar(400), false);
});

test('dados de antes da sincronização: o que foi mexido vence o plano original', () => {
  // Como o app carrega um estado antigo: compara com o plano original e carimba o que difere.
  const antigo = (mexer, agora) => {
    const a = aparelho();
    mexer(a.s);
    darIds(a.s, agora);
    carimbar(a.s, retrato(seed()), agora);
    a.ant = retrato(a.s);
    return a;
  };
  const pc = antigo((s) => {
    s.videos.find((v) => v.id === 'pauta-lancer-0').status = 'publicado';
    s.videos = s.videos.filter((v) => v.id !== 'pauta-gostoso-0');
    s.feitos.push({ data: '2026-10-12', titulo: 'Feito no computador' }); // sem id, como no app antigo
    s.settings.metaLancer = 8500000;
  }, 1791775000000);
  const cel = antigo((s) => {
    s.feitos.push({ data: '2026-10-12', titulo: 'Feito no celular' });
  }, 1791775060000);

  const nuvem = {};
  pc.sincronizar(nuvem);
  cel.sincronizar(nuvem);
  pc.sincronizar(nuvem);
  assert.equal(texto(cel.s), texto(pc.s));
  assert.equal(cel.s.videos.find((v) => v.id === 'pauta-lancer-0').status, 'publicado');
  assert.ok(!cel.s.videos.some((v) => v.id === 'pauta-gostoso-0')); // exclusão do vídeo original se propaga
  assert.equal(cel.s.videos.length, 22);
  assert.deepEqual(cel.s.feitos.map((f) => f.titulo), ['Feito no computador', 'Feito no celular']); // os dois ficam, em ordem
  assert.equal(cel.s.settings.metaLancer, 8500000);
});

test('entrada externa: só passa o que tem a forma do estado', () => {
  assert.equal(valido(JSON.parse(texto(seed()))), true);
  assert.equal(valido({ v: 1 }), false);
  assert.equal(valido({ ...paraNuvem(seed()), leads: [null] }), false);
  assert.equal(valido({ ...paraNuvem(seed()), dias: { x: 'texto' } }), false);
  assert.equal(valido('lixo'), false);
  assert.equal(valido(null), false);
});
