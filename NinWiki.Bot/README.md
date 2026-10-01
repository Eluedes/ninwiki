# NinWiki.Bot

Bot do Discord (discord.py, a mesma stack do Guima.Bot) para **gerenciar a equipe do painel pelo Discord**.
Ele não decide nada sozinho: em cada comando só repassa à API **quem digitou** e o que pediu. A API aplica
as **mesmas regras do painel** (só o S.Adm gerencia a equipe, dono não é rebaixado, ninguém se altera...) e o bot
mostra a resposta. Tudo que o bot faz aparece no log geral com origem **Bot**.

## Comandos (só funcionam em servidor, respostas só você vê)
| Comando | Faz |
|---|---|
| `/equipe listar` | mostra a equipe e o cargo de cada um |
| `/equipe adicionar usuario cargo` | cadastra alguém (o nome vem do Discord) |
| `/equipe cargo usuario cargo` | troca o cargo (derruba a sessão da pessoa) |
| `/equipe desativar usuario` | tira o acesso na hora |
| `/equipe reativar usuario` | devolve o acesso |

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
Coloque `DEV_GUILD_ID=<id do seu servidor de testes>` no `.env` do bot para os comandos aparecerem na hora
(sem isso, comandos globais podem levar até 1 hora). Para achar o ID: Modo Desenvolvedor ligado → botão
direito no servidor → Copiar ID.

## Segurança
- `BOT_API_TOKEN` equivale a uma senha de administrador (quem tem consegue agir como qualquer staff): só no
  `.env`, nunca no Git, nunca em print. O `.gitignore` já ignora `.env`.
- `DISCORD_BOT_TOKEN` idem. Se vazar: Developer Portal → Reset Token.
- `ALLOWED_GUILD_IDS` (opcional, recomendado) limita os comandos aos seus servidores.
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
ninwiki_bot/staff_commands.py  os comandos /equipe
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
