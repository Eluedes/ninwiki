"""
Enums compartilhados entre varios modelos.

Usar Enum do Python (em vez de string solta) faz o banco recusar um
valor invalido na gravacao (ex: rarity="commom" com erro de digitacao
nunca entra no banco) - e' uma camada de validacao a mais, alem do
Pydantic na entrada da API.
"""
import enum


class Rarity(str, enum.Enum):
    """Espelha lib/types.ts -> Rarity no front."""
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    EPIC = "epic"
    LEGENDARY = "legendary"
    UNIQUE = "unique"         # itens unicos do jogo (etiqueta vermelha "Unique", ex.: Metal Knuckle Blades)
    ENCHANTED = "enchanted"   # itens encantados do jogo (ex.: Hokuto Sphere, Authority)


class ContentCategory(str, enum.Enum):
    """
    Espelha lib/types.ts -> Category no front.
    NAO inclui "masteries" - masteries tem suas proprias tabelas
    (ver models/masteries.py), nao vivem em content_items.
    """
    MOBS = "mobs"
    ITEMS = "items"
    GUIDES = "guides"
    WEAPONS = "weapons"
    MISSIONS = "missions"


class MobType(str, enum.Enum):
    """So' usado quando ContentItem.category == MOBS."""
    MONSTER = "monster"
    BOSS = "boss"
    NPC = "npc"
    MOUNT = "mount"


class ItemType(str, enum.Enum):
    """So' usado quando ContentItem.category == ITEMS."""
    GENERAL = "general"
    RING = "ring"
    CONSUMABLE = "consumable"
    MATERIAL = "material"
    # Adicionados na melhoria da ficha de Item (24/09), pra' cobrir os
    # dois tipos que tinham campos proprios na ficha do jogo e nao
    # cabiam em nenhum dos 4 tipos existentes.
    CURRENCY = "currency"
    CAST = "cast"
    ACCESSORY = "accessory"   # acessorios (ficam junto com os Rings no catalogo; mostram nivel como o Ring)
    # Pecas de roupa (equipamento, como o Ring/Accessory: mostram nivel e ficam juntas no filtro Equipment)
    SHIRT = "shirt"
    VEST = "vest"
    PANT = "pant"
    HAT = "hat"
    MASK = "mask"
    SHOE = "shoe"
    PACK = "pack"   # pacotes (catalogo "Pack" da pagina de itens)
    AUTHORITY = "authority"   # itens de Autoridade do cla (ex.: Hokuto Sphere I): levados ao Altar da Casa do Cla


class ContentStatus(str, enum.Enum):
    """Fluxo editorial do painel admin (Fase 4 do roadmap)."""
    DRAFT = "draft"
    PUBLISHED = "published"


class MasteryType(str, enum.Enum):
    """Tipo da mastery: elemental ou nao-elemental."""
    ELEMENTAL = "elemental"
    NON_ELEMENTAL = "non-elemental"


class ProfessionGroup(str, enum.Enum):
    """Grupo da profissao (coleta, producao...)."""
    GATHERING = "gathering"
    CRAFTING = "crafting"


class StaffRole(str, enum.Enum):
    """
    Cargos da equipe (staff) do painel - Fase 2. Ordem = hierarquia:
    quem esta' mais abaixo NUNCA pode mexer em quem esta' acima (ver
    app/core/permissions.py::ROLE_RANK e app/core/staff_service.py).

      SUPER_ADMIN ("S.Adm"): dono do sistema. Tem tudo, e' o unico que
                  enxerga as permissoes/telas exclusivas dele.
      ADMIN ("Adm"):   publica, apaga e gerencia Creators.
      CREATOR ("Creator"): cria e edita RASCUNHOS; nao publica nem apaga.

    O que cada cargo pode fazer fica numa tabela so', em
    app/core/permissions.py - mudar uma regra e' mudar uma linha la'.
    """
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    CREATOR = "creator"


class DropChanceQualifier(str, enum.Enum):
    """
    Como mostrar a porcentagem de chance de um drop na ficha publica -
    espelha a ficha do PROPRIO JOGO (ver imagem de referencia da Larva:
    "Over 10%", "Below 1%"), que nunca mostra o numero exato pro
    jogador, so' uma faixa aproximada.

    Decisao com o Rafael: controle MANUAL, nao automatico - quem
    cadastra o drop escolhe Over/Below/Exato pra' cada linha, o sistema
    nao calcula uma faixa sozinho a partir do numero.
    """
    OVER = "over"    # "Over 10%" - a chance real e' PELO MENOS esse numero
    BELOW = "below"  # "Below 1%" - a chance real e' MENOR que esse numero
