"""
Configuracoes da aplicacao, carregadas automaticamente do arquivo .env.

Usamos pydantic-settings em vez de os.getenv() espalhado pelo codigo
porque: (1) valida o TIPO de cada variavel (ex: access_token_expire_minutes
tem que ser um numero, nao uma string qualquer) e (2) centraliza tudo
em um lugar so', em vez de cada arquivo ler o .env por conta propria.
"""
import ipaddress

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Cada atributo aqui corresponde a uma variavel do .env (o pydantic-settings
    faz a ligacao automaticamente pelo nome, ignorando maiusculas/minusculas
    por causa de case_sensitive=False la' embaixo).
    """

    # "development" ou "production" - usado em varios lugares do codigo
    # para ligar/desligar comportamentos (ex: log verboso do SQL).
    environment: str = "development"

    # String de conexao completa com o Postgres. Sem valor padrao de
    # proposito: se faltar no .env, a aplicacao falha ja' na inicializacao
    # em vez de tentar rodar sem banco e quebrar de forma confusa depois.
    database_url: str

    # TLS com certificado de cliente (usado pelos bancos da SquareCloud). Caminhos relativos a' pasta NinWiki.Api.
    # Todos vazios = sem TLS (banco local). Ver app/core/db_ssl.py e o README (secao do banco na SquareCloud).
    database_ssl_ca: str = ""             # Certificate CA (.crt)
    database_ssl_cert: str = ""           # certificado do cliente (.pem)
    database_ssl_key: str = ""            # chave privada (.key) - vazio se estiver dentro do .pem
    database_ssl_verify_hostname: bool = False   # confere tambem o NOME do host (so' se o certificado do banco bater com ele)

    # Segredo usado para ASSINAR os tokens JWT (prova que o token foi
    # emitido por nos e nao forjado por outra pessoa). NUNCA reaproveitar
    # entre ambientes (local/beta/producao) - se vazar, invalidar e trocar.
    jwt_secret_key: str

    # Algoritmo de assinatura do JWT. HS256 (HMAC-SHA256) e' o padrao
    # para uma chave simetrica simples como a nossa.
    jwt_algorithm: str = "HS256"

    # NAO USADO (sobrou do planejamento inicial): a sessao do painel usa
    # session_hours logo abaixo. Como a API confere no BANCO, a cada
    # requisicao, se a pessoa ainda e' staff ativa (e se o cargo dela nao
    # mudou), uma sessao de algumas horas continua sendo revogavel na
    # hora - nao precisamos do par access/refresh token, que so' seria
    # necessario se a API nao consultasse o banco a cada chamada.
    access_token_expire_minutes: int = 15

    # ---- Fase 2: autenticacao e cargos (S.Adm / Adm / Creator) ----

    # Duracao da sessao do painel (cookie httpOnly com o JWT). Depois
    # disso a pessoa precisa entrar de novo com o Discord.
    session_hours: int = 12

    # Discord IDs (separados por virgula) dos DONOS do sistema - viram
    # S.Adm automaticamente no primeiro login e NAO podem ser rebaixados
    # nem desativados pelo painel/bot (a unica forma de mexer neles e'
    # editar esta linha do .env). E' assim que o primeiro S.Adm nasce,
    # sem precisar mexer no banco na mao. Ex: "123456789012345678,987654321098765432"
    super_admin_discord_ids: str = ""

    # LOGIN DE DESENVOLVIMENTO: entra como qualquer staff cadastrada so'
    # informando o Discord ID, sem passar pelo Discord de verdade - existe
    # pra' testar o painel localmente sem criar um app no Discord.
    # PERIGO: se ficasse ligado em producao, qualquer um entraria como
    # S.Adm. Por isso: so' funciona com ENVIRONMENT=development, e a
    # aplicacao RECUSA INICIAR se for ligado em qualquer outro ambiente
    # (ver _validar_seguranca abaixo).
    dev_login_enabled: bool = False

    # BACKUP (banco + imagens), feito pelo bot a cada BACKUP_INTERVAL_MINUTES e guardado cifrado num canal privado do Discord (ver app/core/backup.py).
    # BACKUP_PASSPHRASE e' a senha do arquivo: vazio = backups DESLIGADOS (nunca gera sem senha). GUARDE-A num gerenciador de senhas: sem ela o backup nao abre.
    # Gere uma com: python -c "import secrets; print(secrets.token_urlsafe(32))"
    backup_passphrase: str = ""
    backup_exclude_tables: str = "traffic_visitors,error_events"   # tabelas que ficam FORA do backup (dados descartaveis), separadas por virgula

    # IMPORTADOR DE NOTICIAS DA STEAM: se STEAM_NEWS_APP_ID estiver preenchido (ex.: 1674010), a API confere a pagina de noticias do jogo a cada
    # STEAM_NEWS_INTERVAL_MINUTES e copia para o blog, com a tag "Patch Notes", cada post novo marcado como `patchnotes` na Steam.
    # Vazio = desligado. Veja app/core/steam_news.py.
    steam_news_app_id: str = ""
    steam_news_interval_minutes: int = 30          # de quanto em quanto tempo conferir (minimo 10)
    steam_news_status: str = "published"           # "published" = vai ao ar na hora; "draft" = entra como rascunho para revisar
    steam_news_author_name: str = ""               # nome mostrado em "por/by" (a desenvolvedora). Vazio = o autor que a Steam informa
    steam_news_require_tag: str = "patchnotes"     # so' importa posts com esta tag da Steam; vazio = importa todos
    # Alem da tag, aceita posts cujo TITULO bate com esta expressao (a Steam nem sempre marca os updates como `patchnotes`: o tipo "Atualizacao regular" nao e' uma tag da API).
    # Expressao regular, sem diferenciar maiusculas. Vazio = so' a tag. Padrao: update / patch / hotfix / versao tipo v6.0.0.9b.
    # --- Manutencao automatica (app/core/maintenance.py): apaga o que ficou velho e inutil para o banco e a memoria nao incharem ---
    maintenance_interval_hours: int = 6            # de quantas em quantas horas roda (0 = desligada)
    error_retention_days_resolved: int = 30        # problemas JA' resolvidos somem depois de N dias sem voltar
    error_retention_days: int = 90                 # qualquer problema (mesmo nao resolvido) some depois de N dias sem ocorrer
    audit_retention_days: int = 365                # log geral (quem fez o que): linhas com mais de N dias somem (0 = nunca apaga)
    # Banner do topo dos posts importados da Steam: o mesmo para todos (a arte do jogo). Caminho do site ou endereco https; vazio = sem banner (usa a capa).
    steam_news_banner_image: str = "/images/blog/steam-banner.webp"
    steam_news_title_pattern: str = r"update|patch|hotfix|\bv?\d+\.\d+(\.\d+)*[a-z]?\b"
    steam_news_max_per_run: int = 5                # teto de posts novos por conferencia (evita inundar o blog na 1a vez)

    # Senha compartilhada entre a API e o NinWiki.Bot (header X-Bot-Token).
    # Vazio = as rotas do bot ficam DESLIGADAS (404). Gere um valor longo
    # e aleatorio: python -c "import secrets; print(secrets.token_urlsafe(48))"
    bot_api_token: str = ""

    # So' ligar quando a API estiver ATRAS de um proxy confiavel (ex:
    # Cloudflare) - ai a API le o IP real do header CF-Connecting-IP pro
    # log. Ligado sem proxy, qualquer um forjaria o IP que aparece no log.
    trust_proxy_headers: bool = False
    # Lista (separada por virgula) de redes/IPs dos PROXIES em que se confia, ex.: "127.0.0.1,172.16.0.0/12" (rede interna do Docker).
    # Com TRUST_PROXY_HEADERS=true, CF-Connecting-IP / X-Forwarded-For so' valem se o IP IMEDIATO da conexao estiver nesta lista -
    # senao quem alcancar a API direto forjaria o IP (e fugiria do limite por IP). Vazia = comportamento antigo (confia em qualquer
    # origem; a API avisa no log). Em hospedagem sem proxy conhecido (SquareCloud) deixe vazia.
    trusted_proxy_cidrs: str = ""

    # Exige que a conta do DISCORD de quem entra no painel tenha a verificacao em duas etapas (2FA) ligada: o Discord informa isso no perfil
    # (escopo identify) e nao guardamos segredo nenhum. Vale para TODA a equipe (inclusive os donos) so' no login real com Discord; o login de
    # desenvolvimento local nao passa por isso. CUIDADO: antes de ligar em producao, ative o 2FA na SUA conta do Discord (Configuracoes > Minha
    # conta), senao voce mesmo fica sem entrar; para desligar, REQUIRE_DISCORD_2FA=false e reinicie.
    require_discord_2fa: bool = True

    # SameSite do cookie de SESSAO (equipe e leitor). "lax" (padrao, o mais seguro) exige site e API no MESMO site
    # (ex: wiki.dominio.com + api.dominio.com). Com enderecos *.squareweb.app (sites diferentes) o login so' persiste com
    # "none" (exige HTTPS; navegadores que bloqueiam cookie de terceiros, como o Safari, continuam sem funcionar).
    # Solucao de verdade: dominio proprio + "lax". "none" so' vale fora de development.
    cookie_samesite: str = "lax"

    # Limite de tentativas (ver app/core/rate_limit.py). Por IP.
    login_requests_per_minute: int = 30   # chamadas de login por minuto
    login_fail_limit: int = 5             # logins negados tolerados...
    login_fail_window_minutes: int = 15   # ...dentro desta janela; passou disso, bloqueia ate' a janela andar
    bot_fail_limit: int = 10              # tokens de bot errados tolerados em 10 minutos
    # O bot so' recebe o IP de quem agiu (canal de log) se a PROPRIA API liberar: assim um token de bot vazado nao entrega o IP da equipe.
    bot_log_show_ip: bool = False

    # Credenciais do OAuth2 do Discord (preenchidas na Fase 2, quando o
    # login "Entrar com Discord" for implementado de verdade).
    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_redirect_uri: str = ""

    # Origem exata do front-end, usada para configurar o CORS no main.py.
    # Mantido restrito a essa URL (nunca "*") para so' o nosso front
    # conseguir chamar a API com credenciais/cookies.
    frontend_origin: str = "http://localhost:3000"
    # Origens EXTRAS aceitas (CORS e CSRF), separadas por virgula. Serve para a transicao de endereco do site
    # (ex.: FRONTEND_ORIGINS=https://antigo.guima.net): as duas origens funcionam; o login sempre volta para FRONTEND_ORIGIN.
    frontend_origins: str = ""

    # URL PUBLICA em que esta propria API e' acessada - usada pra montar
    # o link completo de uma imagem enviada por upload (ex:
    # "http://localhost:8000/uploads/xyz.png"). Em producao, isso vira
    # o dominio real da API (ex: "https://api.ninwiki.com").
    api_base_url: str = "http://localhost:8000"

    # Tamanho maximo aceito num upload de imagem, em megabytes.
    max_upload_size_mb: int = 5

    # ---- Protecao contra abuso (ver app/core/hardening.py) ----
    # Limites por IP, por minuto. A API le' o IP real quando TRUST_PROXY_HEADERS=true (atras da Cloudflare).
    # ATENCAO: o site (Next.js) busca os dados NO SERVIDOR, entao todas as visitas chegam aqui com o IP
    # do servidor do site - por isso o limite de leitura e' alto. Site com muito acesso: aumente.
    public_requests_per_minute: int = 1200   # leituras (GET) por IP
    upload_requests_per_minute: int = 1500   # imagens em /uploads por IP (uma pagina carrega varias)
    write_requests_per_minute: int = 120     # POST/PUT/PATCH/DELETE por IP
    media_upload_requests_per_minute: int = 600  # envios de imagem (POST /media e /uploads/image) por IP: envio em lote (milhares) nao pode ser barrado
    max_json_body_kb: int = 512              # corpo maximo de requisicoes comuns (uploads tem limite proprio)

    # Tamanho maximo de um arquivo anexado a um aviso do quadro da equipe, em MB.
    max_notice_file_mb: int = 200

    # Chave da API da DeepL, usada pra traduzir conteudo automaticamente
    # PT->EN ao criar/editar uma entry (ver app/core/translation.py).
    # Vazio por padrao: sem chave, a traducao automatica simplesmente
    # nao acontece (fica so' com os campos _en vazios ate' alguem
    # preencher a mao ou configurar a chave) - nunca quebra a API por
    # falta dela.
    deepl_api_key: str = ""

    # Diz ao pydantic-settings para ler o arquivo .env (em vez de exigir
    # que as variaveis ja' estejam exportadas no shell) e para nao ligar
    # para maiusculas/minusculas nos nomes das variaveis.
    #
    # extra="ignore": o .env tem variaveis (POSTGRES_USER, POSTGRES_PASSWORD,
    # POSTGRES_DB, POSTGRES_HOST, POSTGRES_PORT) que sao lidas so' pelo
    # docker-compose.yml, nao pela aplicacao Python (que usa DATABASE_URL
    # pronta em vez de montar a conexao a partir dessas pecas separadas).
    # Sem extra="ignore", o Pydantic recusa o .env inteiro so' porque tem
    # variaveis "a mais" que a classe Settings nao declara.
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


    @property
    def super_admin_ids(self) -> set[int]:
        """Discord IDs dos donos (S.Adm fixos) lidos de SUPER_ADMIN_DISCORD_IDS."""
        ids: set[int] = set()
        for raw in self.super_admin_discord_ids.replace(";", ",").split(","):
            raw = raw.strip()
            if raw:
                if not raw.isdigit():
                    raise ValueError(f"SUPER_ADMIN_DISCORD_IDS invalido: '{raw}' nao e' um Discord ID numerico")
                ids.add(int(raw))
        return ids

    @property
    def is_development(self) -> bool:
        """True quando ENVIRONMENT=development."""
        return self.environment == "development"

    @property
    def session_samesite(self) -> str:
        """Valor do SameSite do cookie de sessao ("lax" ou "none")."""
        return self.cookie_samesite.strip().lower()

    @property
    def cookie_secure(self) -> bool:
        """Cookie so' trafega por HTTPS fora do ambiente local."""
        return not self.is_development

    @property
    def trusted_proxy_networks(self) -> list:
        """TRUSTED_PROXY_CIDRS ja' convertido em redes (ipaddress). Entrada invalida derruba a inicializacao (falha alto)."""
        return [ipaddress.ip_network(c.strip(), strict=False) for c in self.trusted_proxy_cidrs.split(",") if c.strip()]

    @property
    def allowed_origins(self) -> list[str]:
        """Origens do front aceitas pelo CORS e pela checagem de CSRF: a principal + as extras de FRONTEND_ORIGINS."""
        extras = [o for o in self.frontend_origins.split(",") if o]
        return [self.frontend_origin, *[o for o in extras if o != self.frontend_origin]]

    @property
    def effective_discord_redirect_uri(self) -> str:
        """URL de retorno do login do Discord (a do .env ou a derivada de API_BASE_URL)."""
        return self.discord_redirect_uri or f"{self.api_base_url.rstrip('/')}/auth/discord/callback"

    @model_validator(mode="after")
    def _normalizar_urls(self) -> "Settings":
        """Tira a "/" final das URLs: FRONTEND_ORIGIN="https://x.com/" nunca bateria com o Origin do navegador (CORS/CSRF quebrariam)."""
        self.frontend_origin = self.frontend_origin.strip().rstrip("/")
        self.frontend_origins = ",".join(o.strip().rstrip("/") for o in self.frontend_origins.split(",") if o.strip())
        self.api_base_url = self.api_base_url.strip().rstrip("/")
        return self

    @model_validator(mode="after")
    def _validar_seguranca(self) -> "Settings":
        """
        Recusa iniciar com uma configuracao insegura. Falhar ALTO na
        inicializacao e' bem melhor do que subir em producao com uma
        brecha que ninguem percebeu.
        """
        if not self.is_development:
            if self.dev_login_enabled:
                raise ValueError(
                    "DEV_LOGIN_ENABLED=true so' e' permitido com ENVIRONMENT=development "
                    "(em outro ambiente qualquer pessoa entraria como S.Adm)."
                )
            if len(self.jwt_secret_key) < 32 or self.jwt_secret_key.startswith("troque"):
                raise ValueError("JWT_SECRET_KEY precisa ter 32+ caracteres aleatorios fora de development.")
        if self.session_samesite not in ("lax", "none"):
            raise ValueError("COOKIE_SAMESITE precisa ser 'lax' ou 'none'.")
        if self.session_samesite == "none" and self.is_development:
            raise ValueError("COOKIE_SAMESITE=none exige HTTPS: use so' fora de development.")
        self.trusted_proxy_networks  # valida o formato dos CIDRs ja' na inicializacao
        self.super_admin_ids  # valida o formato dos IDs ja' na inicializacao
        return self


# Instancia unica (singleton) criada na importacao do modulo. Todo o
# resto do codigo importa este `settings` pronto, em vez de instanciar
# Settings() varias vezes.
settings = Settings()
