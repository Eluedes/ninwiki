"""
De que PAIS vem uma visita - sem mandar o IP de ninguem para servico de terceiros.

Ordem: (1) cabecalho CF-IPCountry da Cloudflare (so' confiavel quando a API esta atras dela: TRUST_PROXY_HEADERS=true);
(2) banco de paises offline `NinWiki.Api/geoip/country.mmdb` (DB-IP "IP to Country Lite", gratuito, baixado no deploy pelo
workflow); (3) "ZZ" (desconhecido). Sem o arquivo e sem Cloudflare tudo cai em "ZZ" - a API nunca quebra por isso.
Dados de geolocalizacao por IP: DB-IP.com (licenca CC BY 4.0).
"""
import ipaddress
from pathlib import Path

UNKNOWN = "ZZ"
DB_PATH = Path(__file__).resolve().parent.parent.parent / "geoip" / "country.mmdb"

_reader = None
_tried = False


def _open_reader():
    """Abre o banco de paises uma vez (None se o arquivo nao existe ou a biblioteca nao esta instalada)."""
    global _reader, _tried
    if _tried:
        return _reader
    _tried = True
    try:
        import maxminddb
        if DB_PATH.is_file():
            _reader = maxminddb.open_database(str(DB_PATH))
    except Exception:  # noqa: BLE001 - geolocalizacao e' opcional: qualquer falha = "desconhecido"
        _reader = None
    return _reader


def valid_country(code: str | None) -> str | None:
    """Codigo ISO de 2 letras em maiusculas, ou None (rejeita lixo, "XX" e "T1" da Cloudflare = desconhecido/Tor)."""
    if code and len(code) == 2 and code.isalpha() and code.upper() not in ("XX", "T1"):
        return code.upper()
    return None


def country_of(ip: str | None, cf_country: str | None = None, trust_header: bool = False) -> str:
    """Pais da visita: cabecalho da Cloudflare (se confiavel), senao o banco offline, senao "ZZ"."""
    if trust_header:
        code = valid_country(cf_country)
        if code:
            return code
    if not ip:
        return UNKNOWN
    try:
        addr = ipaddress.ip_address(ip)
        if addr.is_private or addr.is_loopback:
            return UNKNOWN
        reader = _open_reader()
        if reader is None:
            return UNKNOWN
        record = reader.get(str(addr)) or {}
        return valid_country((record.get("country") or {}).get("iso_code")) or UNKNOWN
    except Exception:  # noqa: BLE001
        return UNKNOWN
