"""Configuracao do bot, lida do .env (mesmo padrao da API: pydantic-settings)."""
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class BotSettings(BaseSettings):
    discord_bot_token: str
    ninwiki_api_url: str = "http://localhost:8000"
    bot_api_token: str
    dev_guild_id: int | None = None
    allowed_guild_ids: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @field_validator("dev_guild_id", mode="before")
    @classmethod
    def _empty_guild_is_none(cls, v):
        # "DEV_GUILD_ID=" (vazio) no .env chega como texto vazio, nao como "sem valor".
        return None if v in ("", None) else v

    @field_validator("bot_api_token")
    @classmethod
    def _token_forte(cls, v: str) -> str:
        if len(v) < 16:
            raise ValueError(
                "BOT_API_TOKEN muito curto (minimo 16 caracteres). Gere um com: "
                'python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return v

    @field_validator("discord_bot_token")
    @classmethod
    def _bot_token_preenchido(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("DISCORD_BOT_TOKEN vazio: pegue no Developer Portal > Bot > Reset Token")
        return v.strip()

    @property
    def allowed_guilds(self) -> set[int]:
        ids: set[int] = set()
        for raw in self.allowed_guild_ids.replace(";", ",").split(","):
            raw = raw.strip()
            if raw:
                if not raw.isdigit():
                    raise ValueError(f"ALLOWED_GUILD_IDS invalido: '{raw}' nao e' um ID numerico")
                ids.add(int(raw))
        return ids
