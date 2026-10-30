# NinWiki.Bot

Bot do Discord (discord.py, a mesma stack do Guima.Bot) para **gerenciar a equipe do painel pelo Discord**.
Ele não decide nada sozinho: em cada comando só repassa à API **quem digitou** e o que pediu. A API aplica
as **mesmas regras do painel** (só o S.Adm gerencia a equipe, dono não é rebaixado, ninguém se altera...) e o bot
mostra a resposta. Tudo que o bot faz aparece no log geral com origem **Bot**.

## Comandos (só funcionam em servidor, respostas só você vê)
| Comando | Faz |
|---|---|
| `/status` | **qualquer pessoa**: API, banco e site no ar agora (tempo de resposta e uptime), em cartão Components V2 |
| `/language language` | **só quem tem "Gerenciar servidor"**: idioma padrão do bot **neste servidor** (English ou Português); vale para `/search` e `/status` e fica salvo em `language_state.json` |
| `/search term [language]` | **qualquer pessoa**: procura no wiki (itens, mobs, armas, guias, missões, masteries, jutsus e posts publicados) e mostra o melhor resultado com **imagem, dados e resumo** (botão para a página completa e um menu para ver os outros resultados) |
| `/drop item` | **qualquer pessoa**: quais **mobs dropam** o item/arma e a chance de cada um (com link para a página); sugere nomes enquanto você digita |
| `/patchnotes` | **qualquer pessoa**: as 3 notícias/patch notes mais recentes do blog (título com link, data e resumo) |
| `/item` `/mob` `/jutsu` `/mastery` `nome` | **qualquer pessoa**: cartão do resultado só do tipo pedido (imagem, dados, resumo, botão da página); sugere nomes |
| `/compare a b` | **qualquer pessoa**: dois itens/armas/mobs/jutsus lado a lado |
| `/map área` | **qualquer pessoa**: zona, mobs e saídas da área + link para o mapa do site (lê `SITE_URL/game-maps/areas-info.json`) |
| `/random` | **qualquer pessoa**: um item/arma/mob sorteado |
| `/help` | **qualquer pessoa**: lista dos comandos no idioma do servidor (resposta só para quem pediu) |

**Convidar o bot:** use o link `https://discord.com/oauth2/authorize?client_id=SEU_APPLICATION_ID&permissions=117760&scope=bot%20applications.commands` (permissões: ver canais, enviar mensagens, links incorporados, anexar arquivos para o backup e histórico). O site já tem o botão pronto (`NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID`).

**Comandos públicos (Components V2):** `/status` (API, banco e site agora) e `/search <termo>` (busca no wiki, cartões com botão *Open*). Qualquer pessoa usa; 1 uso a cada 5–10 s por pessoa.

**Avisos automáticos de queda:** com `ERROR_CHANNEL_ID` (ou `LOG_CHANNEL_ID`) e `SITE_URL` preenchidos, o bot confere API, banco e site a cada `HEALTH_POLL_SECONDS`
e avisa no canal **🔴 ... is DOWN** quando algum cai e **🟢 ... is back online** quando volta (com o tempo fora do ar). Sempre que o bot liga, ele também posta
**🤖 NinWiki monitor started** com o estado atual de cada um. Sem `SITE_URL` o site não é monitorado.

Quem pode o quê é decidido pela API (`NinWiki.Api/app/core/permissions.py`): só o S.Adm gerencia a equipe (Adm e Creator recebem uma recusa). Quem não é da equipe recebe uma recusa.

## Configurar (uma vez)
1. **Bot no Discord:** https://discord.com/developers/applications → sua aplicação (pode ser a mesma do login
   do painel) → **Bot** → **Reset Token** e copie. Não precisa ligar nenhuma "Privileged Intent".
2. **Convidar o bot** (troque `SEU_CLIENT_ID`; ele não precisa de nenhuma permissão):
   `https://discord.com/oauth2/authorize?client_id=SEU_CLIENT_ID&scope=bot+applications.commands&permissions=0`
3. **Senha entre bot e API:** gere um valor longo e coloque **o mesmo** nos dois `.env`:
   `python -c "import secrets; print(secrets.token_urlsafe(48))"`
   - `NinWiki.Api/.env` → `BOT_API_TOKEN=<valor>`
   - `NinWiki.Bot/.env` → `BOT_API_TOKEN=<valor>`
4. **Ambiente do bot** (é separado do venv da API):
   ```
   cd NinWiki.Bot
   py -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   copy .env.example .env      # e preencha DISCORD_BOT_TOKEN, BOT_API_TOKEN e (opcional) DEV_GUILD_ID
   ```

## Rodar
Com a **API já ligada** (`BOT_API_TOKEN` preenchido nela e ela reiniciada):
```
cd NinWiki.Bot
.\venv\Scripts\Activate.ps1
python main.py
```
Os comandos são registrados **na hora** em cada servidor de `ALLOWED_GUILD_IDS` (+ `DEV_GUILD_ID`, o servidor de testes) e os comandos **globais antigos são apagados** (some qualquer comando velho e nada aparece em servidor fora da lista). Sem nenhum dos dois preenchidos, o registro é global e pode levar até 1 hora. Para achar o ID: Modo Desenvolvedor ligado → botão
direito no servidor → Copiar ID.

## Segurança
- `BOT_API_TOKEN` equivale a uma senha de administrador (quem tem consegue agir como qualquer staff): só no
  `.env`, nunca no Git, nunca em print. O `.gitignore` já ignora `.env`.
- `DISCORD_BOT_TOKEN` idem. Se vazar: Developer Portal → Reset Token.
- `ALLOWED_GUILD_IDS` (opcional, recomendado) limita os comandos aos seus servidores: eles só são registrados lá e o bot recusa os outros.
- `BACKUP_CHANNEL_ID` + `BACKUP_PASSPHRASE` (na API): backup cifrado a cada 3 h no canal **privado**; `VERSION_WEBHOOK_URL` (segredo) para a mensagem de versão. Detalhes e passo a passo no README da raiz.
- O bot não lê mensagens, não usa intents privilegiadas e responde só de forma efêmera.
- Discord IDs sempre trafegam como **texto**.

## Testar (sem Discord)
Na pasta `NinWiki.Api` (com `pip install discord.py` no venv da API só para este teste):
```
py scripts/testar_bot_integracao.py
```
Roda o código real do bot contra a API real e executa cada comando com um Discord simulado.
Sem o discord.py instalado, a parte dos comandos é pulada e o resto roda.

## Estrutura
```
main.py                      entrada (python main.py)
ninwiki_bot/config.py        lê e valida o .env
ninwiki_bot/api_client.py    fala com /bot/* da API (não importa discord.py)
```
Contrato completo das rotas: `NinWiki.Api/app/api/bot.py`.


## Log geral no Discord (opcional)
Com `LOG_CHANNEL_ID` preenchido no `.env`, o bot posta nesse canal tudo o que acontece no painel: quem criou/editou/apagou, logins,
mudanças de equipe e de permissões, tentativas negadas, avisos postados. **Nunca** mostra IP nem o texto dos conteúdos.
- O bot precisa de *Ver canal*, *Enviar mensagens* e *Inserir links* **nesse canal** (mantenha o canal visível só para a equipe).
- Ele consulta a API a cada `LOG_POLL_SECONDS` (padrão 20, mínimo 10) e guarda onde parou em `log_state.json` (não repete nem
  perde ações ao reiniciar; na primeira vez começa "de agora", sem despejar o histórico).
- `LOG_IGNORE_ACTIONS=login,logout` esconde as ações citadas (menos ruído).
- Código: `ninwiki_bot/log_feed.py` (o que postar e onde parou) e `main.py` (`_log_tick`). Rota da API: `GET /bot/audit-log`.


## Erros e alertas no Discord (opcional)
Com `ERROR_CHANNEL_ID` (ou só `LOG_CHANNEL_ID`) preenchido, o bot também posta **erros e problemas do wiki** e vigia se a **API, o banco e o site**
estão no ar. Mensagens em inglês; um problema que se repete só gera novo aviso a cada 10 min. Detalhes no README da raiz (seção 2.2).
- `ERROR_CHANNEL_ID`: canal dos erros/alertas (vazio = usa o canal de log). `SITE_URL`: endereço do site para vigiar. `HEALTH_POLL_SECONDS` (mín. 30). `STATUS_CHANNEL_ID` manda o painel e os avisos de queda/volta para um canal **só do monitor** (vazio = usa o de erros); `STATUS_ALERTS=true` volta a mandar mensagens novas de caiu/voltou (padrão: desligado, só o painel); `STATUS_DOWN_AFTER` (padrão 3) define quantas falhas seguidas valem como "caiu". `STATUS_PANEL=true` (padrão) mantém uma mensagem **📡 NinWiki status** no canal, editada a cada checagem (online/offline, tempo de resposta, uptime desde que o bot ligou); `false` = só avisa quando cai/volta.
- Código: `ninwiki_bot/error_feed.py` (o que postar, anti-spam, estado dos serviços) e `main.py` (`_error_tick`, `_health_tick`). Rotas da API: `GET /bot/errors` e `GET /health/ready`.
- Os comandos `/team ...` (gerir equipe e limpar o log pelo Discord) foram **removidos**: equipe, cargos e limpeza do log agora só pelo painel (`/admin/staff`, `/admin/audit-log`).


> **Comando não aparece / `CommandNotFound: Application command 'status' not found`:** com versões antigas do bot e `DEV_GUILD_ID` preenchido os comandos eram registrados **só nesse servidor**; hoje o bot registra em todos os de `ALLOWED_GUILD_IDS` e apaga os globais. Se ainda ver o erro: confira o `ALLOWED_GUILD_IDS` e se o bot foi convidado com o escopo `applications.commands` (o log mostra "Nao consegui registrar os comandos no servidor ..."). Em qualquer outro servidor (ou com comandos antigos que sobraram) o Discord chama um comando que o bot não tem. Em produção deixe `DEV_GUILD_ID` **vazio**, reinicie o bot e aguarde até 1 h para os comandos globais aparecerem; use `ALLOWED_GUILD_IDS` para limitar os servidores.
