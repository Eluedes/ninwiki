# Página de manutenção do site (Cloudflare Worker)

**Problema:** para atualizar o Web você apaga os arquivos do app na SquareCloud e faz o deploy; nesse intervalo o site fica fora do ar e aparece um texto de erro da hospedagem.
**Solução:** um *Worker* da Cloudflare (grátis) fica **na frente do domínio do site**. Se o site de verdade não responde, ele mostra uma página bonita ("Estamos atualizando a wiki") que **se recarrega sozinha** quando o deploy termina. Não existe liga/desliga: aparece quando o app some e desaparece quando ele volta.

**Como ele sabe se o site está no ar:** o NinWiki.Web coloca o cabeçalho `x-ninwiki-web: 1` em **toda** resposta (`next.config.js` + `proxy.ts`). Sem esse cabeçalho (app apagado, texto de erro da SquareCloud, conexão que falhou) o Worker responde a página de manutenção com **HTTP 503 + Retry-After** (o bot do Discord mostra o site como offline, e o Google entende que é temporário). Imagens e outros pedidos que não são páginas recebem só um texto curto 503. **Exceção:** arquivo estático de verdade (imagem, fonte, CSS, JS) respondido com sucesso passa mesmo sem o cabeçalho, porque o Next nem sempre o coloca ao servir a pasta `public` — erro da hospedagem nunca tem esse tipo de conteúdo.

## Passo a passo (uma vez só)
1. **Antes de tudo, rode o Deploy Web** com a versão que tem o cabeçalho `x-ninwiki-web` (esta branch/`main` atual). *Se ligar o Worker antes, ele não vê o cabeçalho e mostra a manutenção o tempo todo.* Confira: `curl -I https://ninwiki.guima.net` deve listar `x-ninwiki-web: 1`.
2. Painel da Cloudflare → **Workers & Pages** → **Create** → **Create Worker** → nome `ninwiki-manutencao` → **Deploy** → **Edit code**.
3. Apague o código de exemplo, cole **todo** o conteúdo de `Cloudflare/maintenance-worker.mjs` e clique **Deploy**.
4. No Worker → **Settings → Domains & Routes → Add → Route**: rota `ninwiki.guima.net/*`, zona `guima.net`. (O registro DNS do `ninwiki` precisa estar **com a nuvem laranja**, proxied.)
5. Teste: no Worker → **Settings → Variables** crie `MAINTENANCE_FORCE` = `1` e abra o site: deve aparecer a página. Apague a variável (ou ponha `0`) e o site volta ao normal.

## Chaves de emergência (Settings → Variables do Worker)
| Variável | Efeito |
|---|---|
| `MAINTENANCE_FORCE=1` | mostra a página **sempre** (manutenção manual, mesmo com o site no ar) |
| `MAINTENANCE_DISABLE=1` | desliga o Worker: passa tudo direto, sem página (se algo der errado, use isto ou remova a rota) |

## Limites e cuidados
- Plano grátis: 100 mil pedidos por dia no Worker (cada página + arquivo conta). Se estourar, a Cloudflare repassa direto ao site (sem a página de manutenção).
- Só vale para o domínio do site (`ninwiki.guima.net`). A API (`api.guima.net`) não passa pelo Worker.
- Se você apagar o app do Web **e** o DNS ainda apontar para ele, o Worker mostra a página; se o DNS for removido, a Cloudflare mostra o erro dela (1014 etc.) antes do Worker.
- Testes do Worker: `node --test Cloudflare/testar_worker.mjs` (precisa do Node 20+).
