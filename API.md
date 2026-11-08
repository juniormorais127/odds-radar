# API de futebol v1

## Coletor local ao vivo · 20 segundos

Execute `Iniciar-Ao-Vivo.ps1` neste PC. Ele inicia Node em segundo plano na porta de loopback 4180; o painel local fica em http://127.0.0.1:4180/ e a API em http://127.0.0.1:4180/api/live. `GET /api/live?eventId=ID` filtra um jogo; `GET /api/live/status` informa ciclo, última coleta, próxima tentativa, erros, contagens e `stale`. Os dados incluem evento, placar, período, horário de observação e todos os mercados ao vivo retornados pela Tobetano. São separados do catálogo pré-jogo.

O robô consulta a cada 20 segundos, sem sobrepor ciclos. Consultas lentas podem alongar o intervalo; após falha, preserva o último snapshot como antigo e reconecta. Depois de 40 segundos sem coleta válida, os dados são marcados como antigos. Jogos encerrados e cybersport são excluídos; odds suspensas ficam sinalizadas. O PC precisa permanecer ligado e conectado, mas o navegador pode ficar fechado. A API só aceita conexões deste PC e não é exposta à internet.

O snapshot local fica em `data/live/latest.json`. As mudanças de preço, com contexto de placar, ficam em `data/live/history/` por hora; arquivos cuja janela terminou há mais de 72 horas são removidos durante a coleta. A retenção técnica pode alcançar até uma hora além da janela pelo particionamento. Movimentos ao vivo não comprovam erro de preço: gols e passagem do tempo mudam as probabilidades. Esses dados locais não atualizam a API pública estática do GitHub a cada 20 segundos. `Parar-Ao-Vivo.ps1` encerra somente o processo identificado como este robô.

Base pública: https://juniormorais127.github.io/odds-radar/api/v1/

Esta versão distribui snapshots JSON estáticos, sem chave, gerados pela coleta do GitHub Actions a cada 30 minutos, sujeita a atrasos. Não é um servidor de consultas em tempo real. Parâmetros na URL não filtram os arquivos; filtre no consumidor.

| Arquivo | Conteúdo |
| --- | --- |
| index.json | Versão, cobertura, contagens e caminhos |
| football.json | Conjunto completo normalizado |
| events.json | Jogos de futebol futuros |
| bookmakers.json | Todas as 11 casas, situação e cobertura |
| quotes.json | Uma cotação por casa, jogo, mercado e seleção |
| bookmakers/giro.json | Cotações da Giro Certo |
| history.json | Séries de cotações automáticas observadas nas últimas 72 horas |
| movement-alerts.json | Movimentos de pelo menos 20% registrados na janela |

Outros códigos de casa: `esporte`, `melbet`, `jogos`, `futamina`, `two`, `grana`, `sportsbet`, `exclusive`, `stake`, `fortune`, `tobetano`.

## Tobetano: todos os mercados de futebol pré-jogo

`tobetano/index.json` lista os jogos e aponta `events[].file` para o JSON completo de cada partida, relativo a `api/v1/tobetano/`. Exemplo: `api/v1/tobetano/events/18904011.json`. Este catálogo é separado do conjunto comparativo `football.json`, que continua restrito a resultado final. A aba **Tobetano · futebol** permite buscar e consultar os mercados por partida, período e linha.

O coletor consulta todos os campeonatos de futebol pré-jogo retornados pelo feed público do iframe, depois todos os eventos e mercados retornados por partida. Não limita a 24 horas nem aos campeonatos principais. Exclui eventos ao vivo, já iniciados, com início passado e cybersport. Revalida o evento antes de obter os mercados. Falhas por pedido aparecem em `failures`; as contagens variam a cada execução e não comprovam a existência de mercados que o provedor não retornou.

Os arquivos por jogo preservam `event`, `observedAt`, `sourceUrl` e `markets`. Cada chave de mercado mantém `eventId`, `resultKind`, `marketType`, `period`, `subPeriod` e `layout` quando presentes; as linhas ficam em `marketItems[].key.marketParameters` e as seleções em `outcomes[].key.type/values`. Não colapsar resultado, período, linha ou valores: gols, escanteios, cartões, jogadores e subperíodos podem ter códigos diferentes mesmo com nome parecido.

`outcomes[].decimalOdds` converte o inteiro do feed (`odd / 100`), validado contra a interface pública. O valor original `odd` também é preservado. `isFrozen` e `event.tradingStatus` identificam suspensão; as contagens incluem suspensas. Os nomes e modelos de tradução originais estão em `tobetano/translations.json`; alguns modelos têm parâmetros e códigos que exigem contexto adicional, por isso a interface preserva esses identificadores em vez de inventar seleções.

Somente resultado final regulamentar (`resultKind=1`, `marketType=2`, `period=0`, sem subperíodo ou layout alternativo) com três seleções abertas entra na comparação entre casas e no histórico de 72h. O catálogo completo dos outros mercados representa a última coleta, não histórico de 72h de todos esses mercados. O iframe publica o identificador do seu SDK na configuração inicial; o coletor o lê a cada execução e não usa login, saldo ou token de usuário.

## Contrato

`eventId` relaciona a cotação com `events.id`; `bookmakerId` relaciona com `bookmakers.id`. IDs são determinísticos a partir dos nomes normalizados e início UTC. Correções de nome ou horário podem alterar o ID; não são identificadores oficiais do provedor. O agrupamento aproveita o pareamento existente, que pode ter ambiguidades entre casas.

O mercado `ft_1x2` representa resultado final no tempo regulamentar. Seleções: `home` (casa), `draw` (empate), `away` (visitante). `decimalOdds` é número decimal. Prorrogação e pênaltis não entram neste mercado. Primeiro tempo e outros mercados ainda não estão integrados nesta versão recorrente; não inferir preços para eles.

`observedAt` é o horário de obtenção, preservado por cotação; `generatedAt` é apenas o horário de geração do arquivo. `sourceUrl` identifica a página de origem. `method` distingue `automatic`, `browser_manual` e `fallback`. Dados inválidos e jogos cujo início já passou são excluídos; não existe confirmação independente de status do jogo neste arquivo.

`freshness: current` significa que a cotação automática tinha até 300 segundos no momento da geração. O consumidor **também deve recalcular a idade no momento do uso**. Snapshots entre coletas tornam-se antigos mesmo se o campo continua `current`. Leitura manual e fallback são sempre históricos. Não usar só o horário do arquivo como prova de atualização.

Todas as casas aparecem no cadastro, mesmo sem cotações. `collectionStatus` relata a tentativa mais recente conhecida, não garante cobertura total; `partial`, `scope` e `coverage.complete: false` deixam explícitos os limites. Uma casa bloqueada pode manter cotações históricas de leituras anteriores. Giro Certo e Futamina podem compartilhar feed; não tratá-las automaticamente como fontes independentes.

## Exemplo de consumo

```js
const base = 'https://juniormorais127.github.io/odds-radar/api/v1/';
const data = await fetch(base + 'football.json').then(r => {
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
});
const now = Date.now();
const quotes = data.quotes.filter(q =>
  q.method === 'automatic' && q.freshness === 'current' &&
  now >= Date.parse(q.observedAt) &&
  now - Date.parse(q.observedAt) <= data.freshnessWindowSeconds * 1000
);
```

Esta é a base para um futuro serviço com banco, filtros no servidor e autenticação. Esses recursos não estão implementados pelo GitHub Pages. O acesso técnico público às fontes não estabelece autorização para redistribuição comercial dos dados.

## Histórico de 72 horas

`history.json` preserva cada série por `id` da cotação (mesmo jogo, casa, mercado e seleção), com `samples: [{at, odds}]`. Inclui metadados do jogo, inclusive se o início já passou durante a janela. A coleta não confirma encerramento do jogo. Pontos anteriores a 72 horas são removidos a cada execução. Leituras manuais, fallback e snapshots antigos não entram. O registro começa na primeira execução desta versão; não existe recuperação retroativa de oscilações não coletadas.

O estado é restaurado do artefato `odds-history-v1` do GitHub Actions e salvo novamente após cada coleta. Os artefatos de recuperação têm retenção técnica de 4 dias; os pontos expostos na API são limitados a 72 horas na geração. Se a coleta parar, o arquivo publicado não expira sozinho: consumidores também devem filtrar `samples.at` pela hora atual. Falhas ao restaurar estado interrompem a publicação em vez de apagar silenciosamente o histórico.

`movement-alerts.json` contém altas e quedas absolutas de pelo menos 20% entre observações consecutivas ou desde a primeira observação retida na janela. Cada alerta inclui `from`, `to`, `changePercent`, `direction` e `scope`. São alterações de preço registradas, não prova de odd errada, valor esperado positivo ou preço ainda disponível. Oscilações entre as coletas de 30 minutos não são captadas.
