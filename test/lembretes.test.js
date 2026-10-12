// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { generateKeyPairSync, createPublicKey, verify } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.self = globalThis; // lembrete.js é o mesmo arquivo que o service worker carrega
await import('../js/lembrete.js');

test('lembrete: de manhã mostra o dia, à noite lembra de contar', () => {
  const resumo = { dias: { '2026-10-12': { followUps: ['Escritório Silva', 'Clínica Sol'], prazos: ['Enviar proposta'], treino: true, tarefa: 'Pesquisar 3 escritórios' } }, ultimoRegistro: '2026-10-11' };
  const manha = montarLembrete(resumo, new Date(2026, 9, 12, 8, 7));
  assert.equal(manha.title, 'Seu dia');
  assert.equal(manha.body, '2 follow-ups: Escritório Silva, Clínica Sol. Vence hoje: Enviar proposta. Dia de treino. Tarefa do dia: Pesquisar 3 escritórios');
  assert.equal(manha.tag, 'manha');

  const noite = montarLembrete(resumo, new Date(2026, 9, 12, 21, 7));
  assert.equal(noite.title, 'Como foi o seu dia?');
  assert.equal(montarLembrete({ ...resumo, ultimoRegistro: '2026-10-12' }, new Date(2026, 9, 12, 21, 7)).title, 'Dia registrado');
  // Domingo com o dia registrado leva para a revisão da semana.
  assert.equal(montarLembrete({ dias: {}, ultimoRegistro: '2026-10-18' }, new Date(2026, 9, 18, 21, 7)).url, './#/semana');
  // Sem resumo guardado (app nunca aberto neste aparelho) ou resumo velho: texto geral, nunca erro.
  assert.equal(montarLembrete(null, new Date(2026, 9, 12, 8, 7)).body, 'Abra o app e veja a tarefa de hoje.');
  assert.equal(montarLembrete({ dias: {} }, new Date(2026, 9, 12, 21, 7)).title, 'Como foi o seu dia?');
});

test('enviador: manda um toque assinado para cada aparelho inscrito com a chave atual', async () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const { d, x, y } = privateKey.export({ format: 'jwk' });
  const publica = Buffer.concat([Buffer.from([4]), Buffer.from(x, 'base64url'), Buffer.from(y, 'base64url')]).toString('base64url');

  const recebidos = [];
  const servidor = createServer((req, res) => {
    let corpo = '';
    req.on('data', (c) => (corpo += c));
    req.on('end', () => {
      recebidos.push({ url: req.url, metodo: req.method, autorizacao: req.headers.authorization, ttl: req.headers.ttl, corpo });
      res.writeHead(req.url === '/cancelado' ? 410 : 201).end();
    });
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const dados = {
    aparelhos: {
      vapid: { publica, d, x, y },
      celular: { endpoint: `${base}/celular`, chave: publica, nome: 'celular' },
      antigo: { endpoint: `${base}/cancelado`, chave: publica, nome: 'computador' },
      outraChave: { endpoint: `${base}/errado`, chave: 'chave-velha', nome: 'celular' },
      estranho: { endpoint: 'ftp://exemplo/x', chave: publica },
    },
  };
  const arquivo = join(mkdtempSync(join(tmpdir(), 'lembretes-')), 'dados.json');
  writeFileSync(arquivo, JSON.stringify(dados));
  const script = fileURLToPath(new URL('../lembretes/enviar.mjs', import.meta.url));
  const saida = await new Promise((ok) => execFile(process.execPath, [script, arquivo], (erro, stdout) => ok({ codigo: erro?.code || 0, stdout })));
  servidor.close();

  assert.equal(saida.codigo, 0, saida.stdout); // inscrição cancelada (410) não é falha
  assert.deepEqual(recebidos.map((r) => r.url).sort(), ['/cancelado', '/celular']);
  const toque = recebidos.find((r) => r.url === '/celular');
  assert.equal(toque.metodo, 'POST');
  assert.equal(toque.corpo, ''); // nenhum dado sai do repositório
  assert.equal(toque.ttl, '14400');

  // A assinatura confere com a chave pública que o aparelho usou para se inscrever.
  const [, jwt, k] = toque.autorizacao.match(/^vapid t=(.+), k=(.+)$/);
  assert.equal(k, publica);
  const [cabecalho, carga, assinatura] = jwt.split('.');
  const chavePublica = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x, y }, format: 'jwk' });
  assert.ok(verify('sha256', Buffer.from(`${cabecalho}.${carga}`), { key: chavePublica, dsaEncoding: 'ieee-p1363' }, Buffer.from(assinatura, 'base64url')));
  const claims = JSON.parse(Buffer.from(carga, 'base64url'));
  assert.equal(claims.aud, base);
  assert.ok(claims.exp > Date.now() / 1000 && claims.exp <= Date.now() / 1000 + 24 * 3600);
  assert.match(claims.sub, /^https:\/\//);
  assert.deepEqual(JSON.parse(Buffer.from(cabecalho, 'base64url')), { typ: 'JWT', alg: 'ES256' });
});
