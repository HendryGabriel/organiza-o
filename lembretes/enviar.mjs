// Enviador dos lembretes. Roda no GitHub Actions do repositório PRIVADO de dados, duas vezes por dia.
// Manda um "toque" de push, sem conteúdo, para cada aparelho que ativou as notificações: o texto do lembrete é
// montado no próprio aparelho, então nenhum dado pessoal sai do repositório.
// Sem dependências: usa só o Node que já vem na máquina do GitHub Actions.
// Uso: node enviar.mjs [caminho do dados.json]
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';

const { aparelhos = {} } = JSON.parse(readFileSync(process.argv[2] || 'dados.json', 'utf8'));
const { vapid, ...inscritos } = aparelhos;
if (!vapid?.d) {
  console.log('Nenhum aparelho ativou as notificações ainda.');
  process.exit(0);
}

// Cada toque é assinado com a chave do app (VAPID): o serviço de push só aceita quem tem a chave da inscrição.
const chave = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: vapid.d, x: vapid.x, y: vapid.y }, format: 'jwk' });
const b64 = (v) => Buffer.from(v).toString('base64url');
function assinatura(origem) {
  const corpo = `${b64(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))}.${b64(JSON.stringify({ aud: origem, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://hendrygabriel.github.io/organiza-o/' }))}`;
  return `${corpo}.${sign('sha256', Buffer.from(corpo), { key: chave, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

let falhas = 0;
for (const [id, a] of Object.entries(inscritos)) {
  // Só endereço de serviço de push (https) e só inscrição feita com a chave atual. O 127.0.0.1 é do teste automático.
  if (!/^https:\/\/|^http:\/\/127\.0\.0\.1:/.test(a?.endpoint || '') || a.chave !== vapid.publica) continue;
  try {
    const res = await fetch(a.endpoint, { method: 'POST', headers: { TTL: '14400', Urgency: 'normal', Authorization: `vapid t=${assinatura(new URL(a.endpoint).origin)}, k=${vapid.publica}` } });
    // 404 e 410: o aparelho cancelou a inscrição. Não é erro; ele se inscreve de novo quando ativar outra vez.
    console.log(`${a.nome || 'aparelho'} ${id.slice(-4)}: ${res.status}`);
    if (!res.ok && res.status !== 404 && res.status !== 410) falhas++;
  } catch (e) {
    console.log(`${a.nome || 'aparelho'} ${id.slice(-4)}: sem resposta (${e.message})`);
    falhas++;
  }
}
process.exit(falhas ? 1 : 0);
