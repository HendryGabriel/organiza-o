# hendry.ia

Painel pessoal de execução. Você conta o dia para a assistente, por texto ou áudio, e ela registra treino, comida, dinheiro, contatos e tarefas. O app mostra **uma** tarefa que cabe no tempo que você tem e responde sobre os seus números.

| Tela | O que faz |
|---|---|
| **Hoje** | Assistente (texto ou áudio), o que já foi registrado no dia, a tarefa do dia (5, 30 ou 90 min, ou descanso) e atalhos. |
| **Negócio** | Funil de prospecção, follow-ups e histórico de contatos. Toda taxa mostra o denominador. |
| **Conteúdo** | Pauta dos vídeos, do relato ao roteiro (com IA) até as publicações por plataforma. |
| **Corpo** | Treinos, alimentação com **foto → calorias pela IA do Google**, peso e o balanço de calorias. |
| **Dinheiro** | Placar do Lancer, análise do mês (de onde vem, para onde vai, onde economizar, quanto a prospecção rende), cartão de crédito e lançamentos, com importação de extrato. |
| **Métricas** | Gráficos semana a semana: ações, leads e funil, vídeos, treinos, calorias, peso, reserva e receita. |
| **Semana** | Revisão com os números reais e até 3 prioridades para a semana seguinte. |

## Usar

Publicado em **<https://hendrygabriel.github.io/organiza-o/>** (GitHub Pages, branch `main`). Cada `git push` atualiza o site em cerca de um minuto.

### No celular, como aplicativo

- **Android (Chrome):** abra o endereço, toque nos três pontos e em "Instalar aplicativo". Também há um botão em Configurações.
- **iPhone (Safari):** abra o endereço, toque em Compartilhar e em "Adicionar à Tela de Início".

Instalado, ele abre em tela cheia, com ícone próprio, e funciona sem internet depois da primeira visita.

### No computador

É um site estático, sem build e sem dependências:

```bash
npm start
```

Abre em `http://localhost:5173`.

## Assistente e IA do Google (Gemini)

1. Crie uma chave em <https://aistudio.google.com/apikey>.
2. No app: Configurações → IA do Google → cole a chave → **Testar conexão**.

Com a chave, a caixa no topo da tela Hoje vira a assistente:

- **Contar o dia** (escrevendo ou gravando até 3 minutos de áudio): ela separa em treinos, refeições com calorias, ações, contatos com leads, dinheiro, tarefas e peso. O app mostra a lista para conferir, nada é gravado antes do "Registrar", e o aviso que aparece depois tem um **Desfazer**.
- **Perguntar**: "onde posso economizar?", "estou em déficit?", "como foi minha semana?". Ela responde só com os números do app.

O que sai do aparelho: o que você escreveu ou falou e um resumo dos seus números (semana, dinheiro por categoria, nomes dos leads, peso e calorias). A chave fica só no navegador daquele aparelho, fora do backup e da sincronização. Como o app chama o Gemini direto do navegador, restrinja a chave ao endereço do seu site (Google Cloud Console → "Restrições de aplicativo" → "Sites"). No plano gratuito, o Google pode usar o conteúdo enviado para melhorar os produtos dele.

O modelo padrão é `gemini-flash-latest`. Dá para trocar em Configurações.

## Dinheiro

- **Receitas** têm fonte (clientes, salário, renda extra) e **gastos** têm categoria. Salário e gasto pessoal aparecem na aba Análise e **nunca** mexem no placar do Lancer nem no resultado dos projetos paralelos.
- **Análise do mês:** de onde vem, para onde vai, quanto sobrou, os gastos variáveis do maior para o menor (comparados com a média deles nos meses anteriores) e quanto a prospecção rende por abordagem, com o ponto em que o funil mais vaza.
- **Cartão de crédito:** a compra conta no mês em que a fatura é paga, pelo dia de fechamento e de vencimento informados em Configurações. Compra parcelada vira uma parcela por fatura. O pagamento da fatura é um tipo próprio e não soma em dobro: no mês, vale o maior entre a fatura paga e as compras lançadas nela, e a diferença aparece como "Cartão sem detalhe".
- **Importar extrato** (Dinheiro → Lançamentos): aceita OFX, CSV e PDF, da conta ou da fatura do cartão. Em OFX e CSV o app lê datas e valores sozinho e só as descrições vão para a IA classificar. Em PDF o arquivo inteiro vai para o Gemini. Você confere antes de lançar; reimportar o mesmo arquivo não duplica e o que já foi lançado à mão é reconhecido.

## Corpo

Na aba Peso: a tendência do peso (kg por semana, pelas medidas dos últimos 30 dias) e o que ela significa em calorias por dia; o saldo entre o que você comeu e o gasto estimado (repouso pela fórmula de Mifflin-St Jeor, rotina e duração dos treinos); e a previsão de chegada na meta. O gasto só é estimado com o perfil preenchido. São referências, não orientação médica ou nutricional.

## Sincronização entre celular e computador

Os dados ficam no navegador de cada aparelho e, com a sincronização ligada, também em um arquivo (`dados.json`) do repositório **privado** `HendryGabriel/organiza-o-dados`. Não há servidor nem conta nova, e cada envio vira um commit, então dá para voltar a uma versão anterior.

Para ligar em um aparelho: Configurações → Sincronização → cole o token → **Ligar sincronização**. O mesmo token serve para todos os aparelhos. Para criar outro, o botão "Criar token" abre o GitHub já preenchido: em "Repository access" escolha "Only select repositories" e marque `organiza-o-dados`.

- Com o app aberto, ele envia o que mudou alguns segundos depois e busca o que o outro aparelho fez ao abrir ou voltar para o app.
- Sem internet, tudo fica guardado e é enviado quando a conexão voltar.
- Os aparelhos são juntados registro a registro: o que só existe de um lado entra, e o mesmo registro alterado nos dois fica com a versão mais recente. Apagar em um apaga no outro.
- O token fica só no aparelho. O app se recusa a enviar dados para um repositório público.

## Notificações

Dois lembretes por dia: por volta das 8h, o que tem para hoje (follow-ups, prazos, treino, tarefa); por volta das 21h, o de contar o dia. Ative em Configurações → Notificações, em cada aparelho. No iPhone, só com o app instalado na Tela de Início.

Como chega com o app fechado: o repositório de dados roda, duas vezes por dia, o enviador desta pasta [`lembretes/`](lembretes). Ele manda um "toque" de push **sem conteúdo** para cada aparelho; o texto é montado no próprio aparelho, com um resumo que o app deixa guardado. Nenhum dado pessoal passa pelo serviço de push. A chave que assina os toques é criada pelo app e fica no repositório privado.

Instalação do enviador (uma vez), no repositório de dados:

```
.github/workflows/lembretes.yml   ← lembretes/lembretes.yml
.github/lembretes.mjs             ← lembretes/enviar.mjs
```

Os horários ficam no `lembretes.yml` (em UTC). O GitHub costuma atrasar alguns minutos.

## Seus dados

- Backup manual: Configurações → Exportar backup. Os arquivos `hendry-ia-backup-*.json` estão no `.gitignore` de propósito.
- Sem a sincronização ligada, limpar os dados do navegador apaga tudo.

## Código

```
index.html, styles.css    casca e estilos
js/app.js                 navegação por hash e despacho de ações
js/core.js                estado, salvar, diálogo, aviso com desfazer
js/logic.js               regras puras (tarefa do dia, funil, dinheiro, semana, o que a IA devolve)
js/analise.js             regras puras das análises: mês, cartão, prospecção, calorias, peso, resumo para a assistente
js/extrato.js             leitura de OFX e CSV, e a conferência contra o que já foi lançado
js/mescla.js              regras puras da sincronização (o que mudou, como juntar dois aparelhos)
js/sinc.js                conversa com o GitHub: baixar, juntar, enviar
js/gemini.js              assistente, foto → calorias, relato → roteiro, classificação de extrato
js/audio.js               gravação do microfone convertida para WAV
js/lembretes.js           notificações: inscrição do aparelho e resumo guardado para o service worker
js/lembrete.js            o texto do lembrete (o mesmo arquivo roda na página e no service worker)
js/seed.js                plano inicial de 12/10 a 31/12/2026 e pauta de vídeos
js/widgets.js             seletor e calendário próprios (nada de <select> ou calendário do navegador)
js/metricas.js            regras puras dos números por semana
js/graficos.js            barras e linhas em HTML e CSS, com dica e tabela
js/views/                 uma tela por arquivo
js/icons.js               ícones Phosphor (MIT)
lembretes/                enviador dos lembretes, que roda no repositório de dados
sw.js                     uso offline e chegada dos lembretes
test/                     testes das regras, da sincronização, do cartão, do extrato e dos lembretes
```

```bash
npm test
```
