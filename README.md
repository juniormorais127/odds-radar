# Radar de Odds

Painel escuro para comparar cotações, buscar jogos, consultar o acervo por esporte e acompanhar alertas de partidas encerradas com cotações ainda retornadas pelas casas.

## Rodar neste computador

Requer Node.js 22 ou superior. Sem dependências externas.

Execute `Iniciar.cmd` no Windows ou `npm start`. Abra http://127.0.0.1:4173.

O servidor consulta o monitor ao iniciar e a cada hora, mesmo sem a página aberta. Precisa permanecer rodando, com o computador ligado e conectado. Os resultados ficam em `data/monitor-latest.json`, fora do Git. Para desabilitar a rotina defina `MONITOR_ENABLED=0`. Para outra porta defina `PORT`.

O servidor aceita apenas conexões locais. Não é disponibilizado pela internet nem por GitHub Pages; o Pages não executa este backend. O site hospedado no Sites continua independente deste servidor local.

## Dados e limites

O catálogo de 35 esportes é histórico, coletado em 05/11/2026; não representa odds atuais. A comparação ao vivo tem cobertura parcial e depende de APIs de terceiros, que podem limitar ou bloquear consultas. Preços diferentes não comprovam valor esperado positivo. Os alertas indicam divergências para conferência, sem confirmar aceitação de apostas.

## Desenvolvimento

Fontes: `worker/backend.js`, `worker/alerts.js`, `worker/page.html`. O arquivo `worker/index.js` é gerado por `npm run build`. O catálogo fica em `worker/catalog-data`. A configuração `.openai/hosting.json` preserva a identidade do site original e não contém credenciais.

Execute `npm test` para verificar parsers, catálogo, monitor e fallbacks. Nunca adicione tokens ou arquivos `.env` ao Git.
`n## GitHub Pages`nA versao estatica usa scripts/build-pages.mjs. O workflow consulta fontes e publica snapshots a cada 30 minutos, sujeito a atrasos do GitHub. Atualizar carrega a ultima coleta publicada; nao consulta as casas pelo navegador. O catalogo continua historico. Habilite Pages com origem GitHub Actions.

As seis casas novas ficam na aba Novas casas, com 27 cotacoes de consulta manual anterior em 06/11/2026. O horario exato nao foi registrado. Os dados nao sao renovados pelo Actions e nao entram em oportunidades atuais. O cadastro esta em worker/house-registry.json.

