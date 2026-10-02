# Guima.Site

Página única **"Em construção"** do Guima — *Construindo e realizando sonhos*. É um servidor Node **sem nenhuma dependência**
(só o que já vem no Node) servindo `public/` (HTML + CSS + JS, sem fontes nem scripts externos).

```
Guima.Site/
├─ server.js            servidor (segurança embutida, ver abaixo)
├─ public/              a página: index.html, style.css, app.js, favicon.svg
├─ scripts/testar_site.mjs   8 testes (npm test)
├─ squarecloud.app      configuração do app na SquareCloud
└─ package.json
```

## Rodar no seu computador
```bash
cd Guima.Site
npm test                 # confere páginas, cabeçalhos de segurança, path traversal e limite por IP
PORT=3100 TRUST_PROXY=false node server.js    # abre em http://localhost:3100
```
(PowerShell: `$env:PORT=3100; $env:TRUST_PROXY="false"; node server.js`)

## Mudar o texto / visual
- Frase de efeito e título: `public/index.html` (h1 e `.tagline`) e as frases que se alternam: lista `phrases` em `public/app.js`.
- Cores: variáveis no topo de `public/style.css`. Porcentagem da obra: `aria-valuenow` no HTML e `'72%'` em `app.js` (e `.bar` no CSS para "reduzir movimento").

## Hospedar na SquareCloud (app novo + subdomínio do Guima)
1. **Criar o app uma vez:** painel SquareCloud → *Add New → New Application* → envie um `.zip` com `Guima.Site/squarecloud.app` e `Guima.Site/server.js` (+ pasta `public/`).
   Se o app não iniciar nesse primeiro envio, não tem problema: o workflow coloca o código completo por cima. Anote o **ID do app**.
2. **Secret no GitHub:** *Settings → Secrets and variables → Actions → New repository secret* → `SQUARE_APP_ID_GUIMA` = o ID do app.
   (`SQUARE_API_KEY` é o mesmo dos outros apps.)
3. **Deploy:** aba *Actions* → **Deploy Guima.Site na SquareCloud (manual)** → *Run workflow*. Ele roda os testes e só então envia.
4. **Domínio:** no painel do app → *Custom domain* → o subdomínio do Guima (ex.: `wiki.dominiodoguima.com`) e siga as instruções de DNS (um `CNAME`).
   Em *Settings* do app o HTTPS é automático.

## Segurança (o que tem e o que NÃO dá para garantir)
O site não tem login, banco, formulário nem dado sigiloso — não há o que roubar. Contra queda:
- **Tudo em memória:** os arquivos são carregados (e comprimidos) na partida; cada visita é só uma consulta num mapa — não lê disco, não existe `../` e a resposta é baratíssima.
- **Só `GET`/`HEAD`** (o resto = 405), URL longa = 414, cabeçalho enorme = 431, cliente lento é desconectado (anti *slowloris*).
- **Limite por IP:** `RATE_LIMIT_PER_MINUTE` (padrão 240) → 429 com `Retry-After`; a tabela de IPs tem teto (`MAX_TRACKED_IPS`), então a memória nunca explode.
- **Cabeçalhos:** CSP que só aceita arquivos do próprio site, HSTS, sem iframe, `nosniff`, sem referrer.
- **Nada derruba o processo:** erros são só registrados; `SIGTERM` encerra com calma.
- Variáveis (opcionais): `PORT`, `RATE_LIMIT_PER_MINUTE`, `TRUST_PROXY` (`true` atrás da SquareCloud/Cloudflare), `MAX_CONNECTIONS`.

**Limite honesto:** nenhum código segura sozinho um ataque *volumétrico* (DDoS) — o "cano" enche antes de chegar no servidor. Para isso,
ponha a **Cloudflare (plano grátis)** na frente do domínio (nameservers no Cloudflare + proxy laranja ligado no subdomínio): ela absorve o
ataque e esconde o servidor. Com `TRUST_PROXY=true` o site passa a enxergar o IP real do visitante (`CF-Connecting-IP`).
