"""Tema festivo do site (uma unica linha, id = 1): 'none' = nenhum (site normal)."""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SiteSeasonalTheme(Base):
    """O tema de epoca festiva ativo no site (natal, ano novo, valentine, pascoa, halloween). Nao tem nada a ver com as CORES do site: so' enfeites e efeitos.
    So' o S.Adm troca. Sem linha ou 'none' = site normal."""
    __tablename__ = "site_seasonal_theme"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    theme: Mapped[str] = mapped_column(String(20), default="none", server_default="none")   # none | christmas | newyear | valentine | easter | halloween
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
