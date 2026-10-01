# Fase 2 — Login e cargos (S.Adm / Adm / Creator) — como usar localmente

Tudo funciona no seu computador. Há dois jeitos de entrar no painel:
**login de desenvolvimento** (rápido, sem Discord) e **login com Discord de verdade**.

## 1) Preparar (uma vez)
Com o **venv da API ativado** (`.\venv\Scripts\Activate.ps1` dentro de `NinWiki.Api`):
```
cd NinWiki.Api
pip install -r requirements.txt            # IMPORTANTE: traz o PyJWT (sem ele a API nem liga: "No module named 'jwt'")
py -m alembic upgrade head                 # cria os cargos e o log geral
py scripts/verificar_projeto.py            # confere tudo (avisa se faltar alguma biblioteca)
```
No `NinWiki.Api/.env`, acrescente (veja `.env.example`):
```
SUPER_ADMIN_DISCORD_IDS=SEU_DISCORD_ID     # você vira S.Adm no primeiro login
DEV_LOGIN_ENABLED=true                     # SÓ local!
```
Seu Discord ID: Discord > Configurações > Avançado > **Modo Desenvolvedor** ligado;
depois botão direito no seu nome > **Copiar ID do usuário**.

## 2) Entrar sem Discord (login de desenvolvimento)
Abra `http://localhost:3000/login`. Aparece uma caixa "Login de desenvolvimento":
digite o Discord ID de alguém **já cadastrado na equipe** (o seu, no começo).
Para testar outro cargo: saia, cadastre alguém em **Equipe**, e entre com o ID dele.
A API **recusa iniciar** se `DEV_LOGIN_ENABLED=true` com `ENVIRONMENT` diferente de `development`.

## 3) Entrar com o Discord de verdade (também local)
1. https://discord.com/developers/applications > **New Application**
2. **OAuth2** > em **Redirects** adicione exatamente:
   `http://localhost:8000/auth/discord/callback`
3. Copie o **Client ID** e o **Client Secret** para o `.env`:
   ```
   DISCORD_CLIENT_ID=...
   DISCORD_CLIENT_SECRET=...
   DISCORD_REDIRECT_URI=http://localhost:8000/auth/discord/callback
   ```
4. Reinicie a API. O botão "Entrar com Discord" passa a funcionar.
Só entra quem está na equipe (ou é dono pelo `.env`). Ter Discord não dá acesso.

## 4) Cargos (tabela única em `NinWiki.Api/app/core/permissions.py`)
| | Creator | Adm | S.Adm |
|---|---|---|---|
| Criar e editar **rascunhos** | sim | sim | sim |
| Editar entry **já publicada** | não | sim | sim |
| Publicar / tirar do ar | não | sim | sim |
| Apagar entries | não | sim | sim |
| Importação em massa | não | sim | sim |
| Editar Masteries, Jutsus, **Vilas, Clãs e Organizações** (Lore) | não | sim | sim |
| Blog: criar/editar **rascunho** | sim | sim | sim |
| Blog: publicar / apagar / editar post publicado | não | sim | sim |
| Upload de imagem / Retraduzir | sim | sim | sim |
| **Equipe** (ver / cadastrar / trocar cargo / desativar) | não | não | **só ele** |
| **Permissões por cargo** (editar o que Adm e Creator podem) | não | não | **só ele** |
| **Quadro de avisos**: ler e baixar arquivos | sim | sim | sim |
| **Quadro de avisos**: postar, editar, apagar, anexar arquivos | não | sim | sim |
| Log de **conteúdo** | histórico da entry | sim | sim |
| Log **completo** (logins, equipe, tentativas negadas, IPs) | não | não | **só ele** |

Esta tabela é o **padrão de fábrica**. O S.Adm ajusta o que **Adm** e **Creator** podem pelo painel, em **Permissões** (`/admin/permissions`), e vale na hora; "Restaurar padrão" volta ao que está acima. Permissões exclusivas do S.Adm aparecem travadas e não podem ser dadas a ninguém. Para mudar o padrão no código: edite `DEFAULT_ROLE_PERMISSIONS`. Para criar um poder que **só o S.Adm
enxerga** (quem não é S.Adm recebe 404, nem sabe que existe): crie a permissão e coloque em
`SUPER_ONLY_PERMISSIONS`. Depois rode o teste (item 6).

## 5) Regras de segurança embutidas
- Sessão em cookie **httpOnly** (JavaScript não lê), `SameSite=Lax`, e `Secure` fora do local.
- Desativar ou trocar o cargo de alguém derruba a sessão dele **na hora**.
- Ninguém altera a si mesmo. **Donos** (`SUPER_ADMIN_DISCORD_IDS`) não são rebaixados nem
  desativados pelo painel/bot. Nunca sobra zero S.Adm ativo.
- Rascunhos são invisíveis para quem não é da equipe (a listagem e a página).
- Todo login, logout, mudança de equipe e tentativa negada vai pro **log geral**, com quem, de onde e IP.

## 6) Testar a segurança (rode depois de mexer em cargos/permissões/rotas)
```
cd NinWiki.Api
py scripts/testar_permissoes.py
```
Simula ataques (token forjado, CSRF, promoção indevida, bot com token errado...) e confere **todas
as rotas da API**: uma rota nova sem proteção faz o teste falhar. Cria e apaga os próprios dados.

## 7) Registrar a equipe pelo Discord (bot)
O bot (`NinWiki.Bot`, discord.py) tem os comandos `/team list|add|role|deactivate|reactivate` e segue
exatamente as mesmas regras do painel. Passo a passo em `NinWiki.Bot/README.md`. Resumo: crie o bot no Discord,
gere um `BOT_API_TOKEN` e coloque **o mesmo valor** no `.env` da API e no `.env` do bot, e rode `python main.py`.
Teste sem Discord: `py scripts/testar_bot_integracao.py` (na pasta `NinWiki.Api`).

## 8) Limite de tentativas (rate limit)
Por IP, em memória (`app/core/rate_limit.py`): 30 chamadas de login por minuto; 5 logins negados em 15 minutos
bloqueiam o IP **antes** de chamar o Discord ou gravar no log; 10 tokens de bot errados em 10 minutos bloqueiam até
o token certo. Quem passa do limite vê "Muitas tentativas" e espera a janela andar (o aviso diz quantos segundos).
Ajustável no `.env` (`LOGIN_REQUESTS_PER_MINUTE`, `LOGIN_FAIL_LIMIT`, `LOGIN_FAIL_WINDOW_MINUTES`, `BOT_FAIL_LIMIT`).
**Ao publicar atrás de um proxy (Cloudflare/SquareCloud)** ligue `TRUST_PROXY_HEADERS=true`; senão todo mundo
parece ter o mesmo IP e uma pessoa que erra bloqueia todas.
