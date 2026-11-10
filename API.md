# API de futebol v1

## Robôs locais por casa

O serviço local inicia um coletor independente para cada uma das 12 casas cadastradas. `GET /api/collectors` mostra situação, próxima tentativa, última coleta válida, contagens e cobertura. `GET /api/houses/{id}` devolve os dados daquele coletor. `GET /api/prematch` reúne os preços de resultado final de pré-jogo no mesmo contrato da API pública, incluindo `bookmakerName` e `selectionLabel` (Casa, Empate, Fora e nomes dos times).

Giro Certo, Esportenet SP, Melbet, Esportenet Jogos, Futamina, Tobetano e Granawin são consultadas normalmente a cada 3 minutos neste PC; ExclusiveBet a cada 5 minutos. O serviço limita a três coletores simultâneos; consultas lentas podem atrasar a próxima execução. Granawin usa paginação da API pública e ExclusiveBet consulta ligas atuais com navegador padrão, sem login. A Tobetano local usa resultado final das próximas 24h e confere primeiro tempo dos favoritos até 1,60; o catálogo completo publicado segue seu processo próprio. As fontes mantêm seus limites de cobertura.

2UP, Sportsbet.io, Stake e FortuneJack recebem tentativas independentes com intervalo de 30 minutos, mas continuam marcadas como bloqueadas quando respondem HTTP 403. Não há solução de CAPTCHA, login automatizado, proxy ou contorno de bloqueios. Uma fonte falhar não interrompe as outras; cotações antigas não são reclassificadas como atuais. As alterações de resultado final por casa são guardadas em `data/robots/history/{casa}/` por hora por aproximadamente 72h, com o mesmo limite técnico de uma hora do particionamento. Os dados desta pasta não são publicados no Git.

## Análise automática local

`GET /api/opportunities` entrega os sinais com modo, casa, preços, regra, horário e tempo gasto na análise. Ao vivo, a análise ocorre imediatamente após cada coleta de 20s. `GET /api/events` transmite avisos SSE para a tela carregar o resultado sem aguardar outro intervalo. O padrão favorito/primeiro tempo exige resultado final até 1,60 e vitória do mesmo time no primeiro tempo acima de 3,00; ao vivo, a verificação é conservadoramente suspensa a partir de 45 minutos no relógio do provedor. Não é um modelo de probabilidade ou prova de erro.

No pré-jogo, cada resultado novo de um robô local dispara nova análise de possíveis surebets, diferenças entre casas de pelo menos 20% e o padrão favorito/primeiro tempo na Tobetano. Sinais ao vivo expiram após 40 segundos sem coleta válida; pré-jogo após 5 minutos. Suspensas, leituras manuais, jogos iniciados no pré-jogo e períodos/linhas incompatíveis ficam fora. A identificação de surebet é matemática e depende de confirmar simultaneamente preços, aceitação e regras nas casas. O ao vivo atualmente recebe somente Tobetano e não afirma arbitragem ao vivo entre várias casas.

Nomes de mercados e seleções acompanham as odds: Casa (time), Empate, Fora (time), totais e handicap, com linha e período separados. Os nomes usam traduções públicas do provedor e preservam o preço original. Seleções especiais sem tradução confirmada são identificadas como não traduzidas; códigos técnicos permanecem na API para rastreabilidade.

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


## Acompanhamento local por seleção

Robôs locais usam intervalo-alvo de 30 segundos no pré-jogo e 20 segundos no ao vivo Tobetano. Cada casa tem agendamento próprio, com até três coletas pré-jogo simultâneas. Coletas demoradas e fila podem ampliar o intervalo, sem sobreposição. Falhas aguardam 3 minutos; bloqueios aguardam 30 minutos. O supervisor reinicia o servidor caso o processo encerre. O PC precisa permanecer ligado e conectado; esta rotina não consome tokens de IA.

No painel local, escolha a partida, o período e uma opção no filtro Seleção (Casa, Empate, Fora, totais ou dupla chance). Use Acompanhar para abrir gráfico e variações da mesma casa, jogo, mercado, período, linha e seleção. O histórico local mantém 72 horas em SQLite, importando os registros anteriores disponíveis.

`http://127.0.0.1:4180/api/live/history?seriesId=ID&hours=72&limit=15000` consulta uma série identificada em cada outcome de `/api/live`. A janela aceita até 72 horas. Coletas não observadas não são reconstruídas. O painel público também permite filtrar Casa, Empate ou Fora no histórico pré-jogo.

Os sinais pré-jogo incluem Abrir jogo quando existe sourceUrl da cotação. O link abre o evento fornecido pela fonte; não promete inclusão automática no bilhete. Mercado, seleção e odd precisam ser conferidos na casa.


## Ao vivo em várias casas

`/api/live` unifica Tobetano (mercados disponíveis), Giro Certo, Futamina e Melbet (resultado final 1X2). `/api/live/collectors` informa a situação independente das três novas fontes. Intervalo-alvo de 20 segundos, sem sobrepor consultas. Falha não renova horários de odds antigas. Cobertura parcial.

Possíveis surebets ao vivo exigem nomes/horário compatíveis, mesmo placar conhecido, mercado final de 90 minutos, odds não suspensas, menos de 40 segundos de idade e até 10 segundos entre consultas. Giro/Futamina são tratados como uma referência compartilhada. Não confirma aceitação nem liquidação.

Jogos vistos como encerrados pelo estágio 9 (traduzido pelo fornecedor como Encerrado) permanecem na tela local sem odds disponíveis. O histórico ao vivo local e registros por hora do jogo são removidos 24 horas após a confirmação, com verificação a cada minuto. Confirmações podem ser propagadas entre fontes apenas com identidade/horário compatíveis. Ausência da lista significa Sem atualização, sem presumir fim. Histórico pré-jogo e snapshots públicos do GitHub mantêm sua política separada de 72 horas.


## Escolha dos robôs locais

O menu Casas que os robôs devem consultar salva uma lista comum para pré-jogo e ao vivo em `data/live/selected-houses.json`. Desmarcar uma casa impede novas consultas e retira suas odds e sinais das APIs atuais; uma consulta já em andamento pode concluir. O histórico não é apagado. Fontes em espera respeitam o agendamento e os intervalos de bloqueio. Uma lista vazia pausa todas as casas.

`GET /api/collector-settings` retorna `{selected, houses}`. `PUT /api/collector-settings` recebe JSON `{selected: ["giro", "melbet"]}` e salva a seleção. A alteração é exclusiva do servidor local; o agendamento público do GitHub permanece separado.
