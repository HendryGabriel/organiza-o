// Regras puras da sincronização (sem rede nem DOM), para rodar também em `node --test`.
//
// Cada registro guarda `mod`: o instante em que mudou pela última vez. Dois aparelhos juntam seus estados
// registro a registro e o mais recente vence. Apagar também é uma mudança: fica anotado em `apagados`,
// senão o registro voltaria do outro aparelho.

export const LISTAS = ['feitos', 'tasks', 'leads', 'videos', 'financas', 'treinos', 'refeicoes', 'medidas'];
// `aparelhos` guarda a inscrição de notificação de cada aparelho e a chave que assina os lembretes (ver lembretes.js).
export const MAPAS = ['dias', 'plano', 'rotina', 'revisoes', 'aparelhos'];

const conteudo = ({ mod, ...resto }) => JSON.stringify(resto);
const ordem = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const ordenado = (mapa) => Object.fromEntries(Object.entries(mapa).sort(([a], [b]) => ordem(a, b)));

function* registros(state) {
  for (const l of LISTAS) for (const r of state[l]) yield [`${l}:${r.id}`, r];
  for (const m of MAPAS) for (const [k, r] of Object.entries(state[m])) yield [`${m}:${k}`, r];
  yield ['settings', state.settings];
}

// Retrato do estado: chave do registro -> conteúdo. Comparar dois retratos diz o que mudou entre dois salvamentos.
export const retrato = (state) => new Map([...registros(state)].map(([chave, r]) => [chave, conteudo(r)]));

// Carimba `mod` no que mudou desde o retrato anterior e anota o que sumiu.
// Roda em todo salvamento, então as telas alteram o estado à vontade sem saber que existe sincronização.
export function carimbar(state, anterior, agora) {
  const atual = retrato(state);
  let mudou = false;
  for (const [chave, r] of registros(state)) {
    if (anterior.get(chave) === atual.get(chave)) continue;
    r.mod = agora;
    mudou = true;
  }
  for (const chave of anterior.keys()) {
    if (atual.has(chave)) continue;
    state.apagados[chave] = agora;
    mudou = true;
  }
  return { retrato: atual, mudou };
}

// O mais recente vence. No empate o critério é fixo, para os dois aparelhos chegarem ao mesmo resultado.
function vence(a, b) {
  if (!a || !b) return a || b;
  const [ma, mb] = [a.mod || 0, b.mod || 0];
  if (ma !== mb) return ma > mb ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

// Junta o estado deste aparelho com o que veio da nuvem. Nada se perde: o que só existe de um lado entra,
// e o mesmo registro alterado nos dois lados fica com a versão mais recente.
// ponytail: `apagados` nunca é limpo. São poucos bytes por exclusão; podar só se o arquivo pesar.
export function mesclar(local, remoto) {
  const apagados = { ...remoto.apagados };
  for (const [k, t] of Object.entries(local.apagados || {})) apagados[k] = Math.max(t, apagados[k] || 0);
  const vivo = (chave, r) => !(apagados[chave] >= (r.mod || 0));
  const junto = { ...local, apagados };

  for (const l of LISTAS) {
    const porId = new Map();
    for (const r of [...(remoto[l] || []), ...local[l]]) porId.set(r.id, vence(porId.get(r.id), r));
    // Os ids começam pelo instante da criação, então ordenar por id é ordenar por data de criação.
    junto[l] = [...porId.values()].filter((r) => vivo(`${l}:${r.id}`, r)).sort((a, b) => ordem(a.id, b.id));
  }
  for (const m of MAPAS) {
    junto[m] = {};
    for (const k of new Set([...Object.keys(remoto[m] || {}), ...Object.keys(local[m])])) {
      const r = vence(local[m][k], remoto[m]?.[k]);
      if (vivo(`${m}:${k}`, r)) junto[m][k] = r;
    }
  }
  junto.settings = vence(local.settings, remoto.settings);
  return junto;
}

// A parte do estado que vai para a nuvem, sempre na mesma ordem: dois aparelhos com os mesmos dados
// geram exatamente o mesmo texto. Cronômetro e data do backup são de cada aparelho e ficam de fora.
export function paraNuvem(state) {
  const nuvem = { v: 1 };
  for (const l of LISTAS) nuvem[l] = [...state[l]].sort((a, b) => ordem(a.id, b.id));
  for (const m of MAPAS) nuvem[m] = ordenado(state[m]);
  nuvem.settings = state.settings;
  nuvem.apagados = ordenado(state.apagados || {});
  return nuvem;
}

// Arquivo da nuvem e backup importado são entrada externa: só valem se tiverem a forma do estado deste app.
export const valido = (dados) =>
  dados?.v === 1 &&
  LISTAS.every((l) => Array.isArray(dados[l]) && dados[l].every((r) => r && typeof r === 'object')) &&
  MAPAS.every((m) => dados[m] === undefined || (dados[m] && typeof dados[m] === 'object' && Object.values(dados[m]).every((r) => r && typeof r === 'object')));

// Todo registro precisa de id para ser comparado entre aparelhos. Dados antigos (ações concluídas) não tinham.
// O id mantém a ordem original e não repete entre aparelhos.
export function darIds(state, agora, sorteio = () => Math.random().toString(36).slice(2, 6)) {
  const base = agora.toString(36);
  for (const l of LISTAS) state[l].forEach((r, i) => (r.id ||= `${base}${String(i).padStart(5, '0')}${sorteio()}`));
}
