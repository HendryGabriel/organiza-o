import { num, AREAS } from './logic.js?v=6';

// Corrige o registro existente e seus vínculos; nunca cria uma segunda cópia.
export function editarRegistro(state, lista, id, campos) {
  const registro = state[lista]?.find((r) => r.id === id);
  if (!registro) return { campo: '', mensagem: 'Este registro não existe mais. Atualize a lista.' };
  const titulo = String(campos.titulo || '').trim();
  if (['feitos', 'tasks'].includes(lista)) {
    if (!titulo) return { campo: 'titulo', mensagem: 'Preencha o título.' };
    const min = num(campos.min);
    if (!Number.isFinite(min) || min < 0) return { campo: 'min', mensagem: 'Informe uma duração válida.' };
    Object.assign(registro, { titulo, area: AREAS[campos.area] ? campos.area : 'pessoal', min: Math.round(min) });
    if (lista === 'tasks') {
      registro.prazo = campos.prazo || '';
      for (const feito of state.feitos.filter((f) => f.chave === `task:${id}`)) Object.assign(feito, { titulo, area: registro.area, min: registro.min });
    } else {
      registro.data = campos.data;
      const tarefa = state.tasks.find((t) => registro.chave === `task:${t.id}`);
      if (tarefa) Object.assign(tarefa, { titulo, area: registro.area, min: registro.min, feitaEm: registro.data });
    }
  } else if (lista === 'medidas') {
    const peso = num(campos.peso);
    if (!(peso > 0 && peso < 500)) return { campo: 'peso', mensagem: 'Use um número como 78,4.' };
    Object.assign(registro, { data: campos.data, peso, obs: String(campos.obs || '').trim() });
  }
  return null;
}
