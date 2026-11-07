# API de futebol v1

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

Outros códigos de casa: `esporte`, `melbet`, `jogos`, `futamina`, `two`, `grana`, `sportsbet`, `exclusive`, `stake`, `fortune`.

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

Esta é a base para um futuro serviço com banco, histórico de variações, filtros no servidor e autenticação. Esses recursos não estão implementados pelo GitHub Pages. O acesso técnico público às fontes não estabelece autorização para redistribuição comercial dos dados.
