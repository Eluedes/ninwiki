"""Configuracao do bot, lida do .env (mesmo padrao da API: pydantic-settings)."""
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class BotSettings(BaseSettings):
    """Configuracao do bot lida do .env (valida tudo ao iniciar)."""
    discord_bot_token: str
    ninwiki_api_url: str = "http://localhost:8000"
    bot_api_token: str
    dev_guild_id: int | None = None
    allowed_guild_ids: str = ""
    # Canal do Discord onde o bot posta o log geral (vazio = recurso desligado).
    log_channel_id: int | None = None
    # Canal dos ERROS/PROBLEMAS do wiki e dos avisos "API/site fora do ar" (vazio = usa o canal de log; sem nenhum = desligado).
    error_channel_id: int | None = None
    # Canal SO' do monitor (painel "Nin Codex status" e avisos de API/banco/site caiu/voltou), para nao misturar com os erros do wiki. Vazio = usa o canal de erros.
    status_channel_id: int | None = None
    # Endereco publico do site (ex: https://wiki.seudominio.com): o bot confere se esta' no ar. Vazio = nao vigia o site.
    site_url: str = ""
    # (opcional) Endereco SO para a checagem de saude (ex: https://ninwiki.squareweb.app, o endereco direto da hospedagem, sem Cloudflare/cache na frente).
    # Vazio = checa o proprio SITE_URL. Os links dos botoes do /search continuam usando o SITE_URL.
    site_health_url: str = ""
    # BACKUP: canal PRIVADO do Discord onde o bot guarda o backup cifrado (banco + imagens) a cada BACKUP_INTERVAL_MINUTES (padrao 180 = 3 h), em partes
    # (o Discord limita o tamanho de cada arquivo) e apagando os mais antigos (mantem os BACKUP_KEEP mais recentes). Vazio = sem backup.
    # Exige BACKUP_PASSPHRASE na API (sem ela a API recusa gerar). O bot precisa de "Anexar arquivos" nesse canal.
    backup_channel_id: int | None = None
    backup_interval_minutes: int = 180
    backup_keep: int = 8
    backup_part_mb: int = 9
    # WEBHOOK (URL do Discord: Configuracoes do canal > Integracoes > Webhooks) onde o bot mantem UMA mensagem "Latest updates" com a versao mais recente
    # da API e do site, EDITANDO a mesma mensagem a cada deploy (nao enche o chat). A URL e' um segredo: so' no .env. Vazio = desligado.
    version_webhook_url: str = ""
    # Manda tambem uma mensagem NOVA a cada "caiu" / "voltou" (alem do painel que se edita sozinho). Padrao false: o painel basta e nao enche o canal.
    status_alerts: bool = False
    # Mantem UMA mensagem "Nin Codex status" no canal de erros, editada a cada checagem (estado ao vivo, tempo de resposta, uptime). false = so' avisa quando cai/volta.
    status_panel: bool = True
    # Quantas checagens SEGUIDAS precisam falhar para avisar "caiu" (maior = menos alarme falso por oscilacao de rede). Minimo 1.
    status_down_after: int = 3
    # De quantos em quantos segundos conferir API/banco/site (minimo 30).
    health_poll_seconds: int = 60
    # De quantos em quantos segundos o bot confere se ha' acao nova (minimo 10 para nao martelar a API).
    log_poll_seconds: int = 20
    # Mostra o IP de quem agiu no canal de log. O canal deve ser visivel SO' para a equipe (IP e' dado pessoal); false = nao mostra.
    log_show_ip: bool = True
    # Acoes que NAO devem ir para o canal (separadas por virgula), ex: "login,logout" para reduzir ruido.
    log_ignore_actions: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @field_validator("dev_guild_id", "log_channel_id", "error_channel_id", "status_channel_id", "backup_channel_id", mode="before")
    @classmethod
    def _empty_guild_is_none(cls, v):
        """Campo de ID vazio no .env vira None (recurso desligado)."""
        # "DEV_GUILD_ID=" (vazio) no .env chega como texto vazio, nao como "sem valor".
        return None if v in ("", None) else v

    @field_validator("log_poll_seconds")
    @classmethod
    def _poll_minimo(cls, v: int) -> int:
        """Recusa intervalo de consulta do log menor que 10 segundos."""
        if v < 10:
            raise ValueError("LOG_POLL_SECONDS minimum is 10")
        return v

    @field_validator("backup_interval_minutes")
    @classmethod
    def _backup_interval_minimo(cls, v: int) -> int:
        """Recusa backup mais frequente que a cada 30 minutos (cada um le' o banco inteiro e manda arquivos ao Discord)."""
        if v < 30:
            raise ValueError("BACKUP_INTERVAL_MINUTES minimum is 30")
        return v

    @field_validator("backup_keep", "backup_part_mb")
    @classmethod
    def _backup_limites(cls, v: int, info) -> int:
        """BACKUP_KEEP >= 1 e BACKUP_PART_MB entre 1 e 24 (limite de arquivo do Discord)."""
        if v < 1 or (info.field_name == "backup_part_mb" and v > 24):
            raise ValueError(f"{info.field_name.upper()} out of range")
        return v

    @field_validator("status_down_after")
    @classmethod
    def _down_after_minimo(cls, v: int) -> int:
        """Recusa menos de 1 falha para considerar um servico fora do ar."""
        if v < 1:
            raise ValueError("STATUS_DOWN_AFTER minimum is 1")
        return v

    @field_validator("health_poll_seconds")
    @classmethod
    def _health_minimo(cls, v: int) -> int:
        """Recusa intervalo de checagem de saude menor que 30 segundos."""
        if v < 30:
            raise ValueError("HEALTH_POLL_SECONDS minimum is 30")
        return v

    @property
    def errors_channel(self) -> int | None:
        """Canal que recebe erros e avisos de saude: o proprio ERROR_CHANNEL_ID, ou o canal de log se aquele estiver vazio."""
        return self.error_channel_id or self.log_channel_id

    @property
    def status_channel(self) -> int | None:
        """Canal do monitor de saude: o proprio STATUS_CHANNEL_ID, ou o canal de erros/log se aquele estiver vazio."""
        return self.status_channel_id or self.errors_channel

    @property
    def ignored_log_actions(self) -> set[str]:
        """Acoes que nao vao pro canal de log (LOG_IGNORE_ACTIONS)."""
        return {a.strip() for a in self.log_ignore_actions.split(",") if a.strip()}

    @field_validator("bot_api_token")
    @classmethod
    def _token_forte(cls, v: str) -> str:
        """Recusa BOT_API_TOKEN curto demais (minimo 16 caracteres)."""
        if len(v) < 16:
            raise ValueError(
                "BOT_API_TOKEN is too short (minimum 16 characters). Generate one with: "
                'python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return v

    @field_validator("discord_bot_token")
    @classmethod
    def _bot_token_preenchido(cls, v: str) -> str:
        """Recusa DISCORD_BOT_TOKEN vazio."""
        if not v.strip():
            raise ValueError("DISCORD_BOT_TOKEN is empty: get it in the Developer Portal > Bot > Reset Token")
        return v.strip()

    @property
    def allowed_guilds(self) -> set[int]:
        """Conjunto de servidores onde os comandos sao aceitos (vazio = qualquer um)."""
        ids: set[int] = set()
        for raw in self.allowed_guild_ids.replace(";", ",").split(","):
            raw = raw.strip()
            if raw:
                if not raw.isdigit():
                    raise ValueError(f"Invalid ALLOWED_GUILD_IDS: '{raw}' is not a numeric ID")
                ids.add(int(raw))
        return ids
