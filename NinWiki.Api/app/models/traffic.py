"""
Acessos ao site (grafico e paises da Visao Geral do painel) - SO' CONTAGENS, nunca o IP nem dado pessoal.

  - TrafficDaily:   visualizacoes e visitantes unicos por DIA e PAIS;
  - TrafficPage:    visualizacoes por DIA e PAGINA (as mais vistas);
  - TrafficVisitor: "impressao digital" anonima do visitante no dia (hash com sal secreto) so' para contar visitantes
                    unicos; linhas com mais de 2 dias sao apagadas sozinhas.
"""
from datetime import date

from sqlalchemy import Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TrafficDaily(Base):
    """Visualizacoes e visitantes unicos de um dia vindos de um pais (codigo ISO de 2 letras; "ZZ" = desconhecido)."""
    __tablename__ = "traffic_daily"

    day: Mapped[date] = mapped_column(Date, primary_key=True)
    country: Mapped[str] = mapped_column(String(2), primary_key=True)
    views: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    visitors: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class TrafficPage(Base):
    """Visualizacoes de uma pagina (caminho) em um dia."""
    __tablename__ = "traffic_pages"

    day: Mapped[date] = mapped_column(Date, primary_key=True)
    path: Mapped[str] = mapped_column(String(200), primary_key=True)
    views: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class TrafficVisitor(Base):
    """Hash anonimo (dia + IP + navegador + segredo) que diz "este visitante ja' foi contado hoje"."""
    __tablename__ = "traffic_visitors"

    day: Mapped[date] = mapped_column(Date, primary_key=True)
    visitor_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
