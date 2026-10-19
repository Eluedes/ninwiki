"""
Cria os artigos do Guia que o wiki ainda nao tem (Zonas, Crime, Equipes, Controles, Niveis...), tendo como referencia a pagina de Guias do Nin Online Wiki
(Fandom). Os textos foram reescritos com palavras proprias, em ingles e em portugues, so' com os fatos estaveis daquelas paginas - numeros que a propria
comunidade marca como desatualizados ficaram de fora. Quem ja existe (mesmo id) e' pulado.

Por padrao os artigos entram como RASCUNHO (so' a equipe ve): revise no painel (Guia > Artigos) e publique. `--publicar` ja' cria publicados.
Por padrao e' SIMULACAO; grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/criar_guias_do_fandom.py                 # simulacao
    python scripts/criar_guias_do_fandom.py --aplicar       # grava no banco local
"""
import argparse
import asyncio
import json
import sys

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.enums import ContentStatus
from app.models.guide import GuideArticle
from scripts._guarda_banco import exigir_banco_local


def texto(t: str) -> dict:
    """No' de texto do Tiptap."""
    return {"type": "text", "text": t}


def doc(*blocos) -> str:
    """Documento Tiptap (JSON em texto) a partir de blocos: ("p", texto), ("h", titulo) ou ("ul", [itens])."""
    conteudo = []
    for tipo, valor in blocos:
        if tipo == "p":
            conteudo.append({"type": "paragraph", "content": [texto(valor)]})
        elif tipo == "h":
            conteudo.append({"type": "heading", "attrs": {"level": 2}, "content": [texto(valor)]})
        elif tipo == "ul":
            conteudo.append({"type": "bulletList", "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [texto(i)]}]} for i in valor]})
    return json.dumps({"type": "doc", "content": conteudo}, ensure_ascii=False)


# (id, secao, posicao, icone, titulo EN, titulo PT, resumo EN, resumo PT, corpo EN, corpo PT)
ARTIGOS = [
    ("start-here", "new-player", 1, "compass",
     "Things worth knowing early", "O que vale saber no começo",
     "A few rules that catch new players out, none of them obvious from the tutorial.",
     "Algumas regras que pegam os novatos de surpresa; nenhuma delas é óbvia no tutorial.",
     doc(("p", "Nin Online is built as a long journey, not a race. These are the things the tutorial does not make obvious:"),
         ("ul", ["Your village is a commitment. The village you pick at character creation decides your missions, your shops and who counts as an enemy.",
                 "You are not safe everywhere. Other players can attack you outside a safe zone, so learn the three zone types before you wander.",
                 "Killing your own side has a price. Kill allied ninja three times in a war or danger zone and you become a Missing Ninja, locked out of your own village.",
                 "Crime gets you arrested. Carry Crime and go down in front of the Military Police and you wake up in jail.",
                 "Join a guild. Guilds give buffs and make levelling far easier.",
                 "Read the stats page before spending points, and think before picking a mastery: it is permanent.",
                 "Chakra does not come back on its own. Hold C while standing still to charge it.",
                 "Party up. Experience is split between team members and then boosted for every extra member.",
                 "There is no rush: the game is built around a long climb to the level cap."])),
     doc(("p", "Nin Online foi feito como uma longa jornada, não uma corrida. Estas são as coisas que o tutorial não deixa óbvias:"),
         ("ul", ["Sua vila é um compromisso. A vila escolhida na criação do personagem decide suas missões, suas lojas e quem é inimigo.",
                 "Você não está seguro em todo lugar. Outros jogadores podem te atacar fora de uma zona segura, então aprenda os três tipos de zona antes de sair andando.",
                 "Matar o seu próprio lado tem preço. Mate ninjas aliados três vezes numa zona de guerra ou de perigo e você vira Ninja Desertor, barrado na sua própria vila.",
                 "Crime leva à prisão. Com Crime e derrotado na frente da Polícia Militar, você acorda na cadeia.",
                 "Entre numa guilda. Guildas dão bônus e deixam o nível muito mais fácil.",
                 "Leia a página de atributos antes de gastar pontos e pense antes de escolher uma maestria: ela é permanente.",
                 "O chakra não volta sozinho. Segure C parado para carregá-lo.",
                 "Forme equipe. A experiência é dividida entre os membros e depois aumentada a cada membro extra.",
                 "Não há pressa: o jogo foi feito para uma longa subida até o nível máximo."]))),

    ("daily-updates", "new-player", 2, "calendar-check",
     "Daily Updates", "Atualizações diárias",
     "The panel that greets you at login: daily rewards, village scores and notices.",
     "O painel que recebe você no login: recompensas diárias, pontuação da vila e avisos.",
     doc(("p", "Daily Updates is the panel you see when you log in. It carries your daily login reward, the newest Cash Shop items, an invite to your village's Discord server, your village's scores and the notices posted by your village leadership."),
         ("h", "Daily login rewards"),
         ("p", "Logging in is not enough on its own: you have to play for at least 15 minutes that day before the reward can be claimed. The rewards run on a 28-day calendar made of the same seven-day pattern repeated, ending on a larger payout on day 28. Claimed days are greyed out, today is highlighted and upcoming days are outlined.")),
     doc(("p", "Atualizações diárias é o painel que aparece quando você entra no jogo. Ele traz a recompensa diária de login, os itens mais novos da Cash Shop, um convite para o servidor de Discord da sua vila, a pontuação da vila e os avisos da liderança."),
         ("h", "Recompensas diárias de login"),
         ("p", "Só entrar não basta: é preciso jogar pelo menos 15 minutos no dia para poder resgatar a recompensa. As recompensas seguem um calendário de 28 dias, formado pelo mesmo padrão de sete dias repetido, com um prêmio maior no dia 28. Dias já resgatados ficam apagados, o dia de hoje fica destacado e os próximos têm contorno."))),

    ("zones", "combat", 1, "shield",
     "Zones and PvP", "Zonas e PvP",
     "Safe, danger and war zones, and who is allowed to attack you in each.",
     "Zonas seguras, de perigo e de guerra, e quem pode te atacar em cada uma.",
     doc(("p", "Every map belongs to one of three zone types, shown under the map name. They decide where PvP can happen."),
         ("ul", ["Safe Zone: ninja of the same village can only fight each other if both turn PvP mode on. Ninja from an enemy village can always fight, even here.",
                 "Danger Zone: a ninja of your own village can attack you if either of you has PvP mode on. Turning it on lets you attack anyone from your village, and also makes you a target for all of them.",
                 "War Zone: PvP is always active and ninja of the same village can attack one another freely."]),
         ("p", "Killing fellow villagers is outlawed and punished: see the Crime System and Missing Ninja pages. In your own village's safe zones you can toggle PvP mode with the P key or the PvP button at the bottom of the screen. The boss maps of the Land of Spirits are war zones, so endgame bosses are contested.")),
     doc(("p", "Todo mapa pertence a um de três tipos de zona, mostrado embaixo do nome do mapa. Elas decidem onde pode haver PvP."),
         ("ul", ["Zona Segura: ninjas da mesma vila só lutam entre si se os dois ligarem o modo PvP. Ninjas de uma vila inimiga sempre podem lutar, até aqui.",
                 "Zona de Perigo: um ninja da sua vila pode te atacar se um dos dois estiver com o PvP ligado. Ligá-lo deixa você atacar qualquer um da sua vila, e também faz de você alvo de todos eles.",
                 "Zona de Guerra: o PvP está sempre ativo e ninjas da mesma vila podem se atacar livremente."]),
         ("p", "Matar companheiros de vila é proibido e punido: veja as páginas Sistema de Crimes e Ninja Desertor. Nas zonas seguras da sua própria vila você liga e desliga o PvP com a tecla P ou com o botão PvP na parte de baixo da tela. Os mapas de chefe da Terra dos Espíritos são zonas de guerra, então os chefes do fim do jogo são disputados."))),

    ("crime-system", "combat", 2, "siren",
     "Crime System", "Sistema de Crimes",
     "How attacking without justification earns you Crime, and what happens next.",
     "Como atacar sem justificativa gera Crime, e o que acontece depois.",
     doc(("p", "The Crime System tracks criminal activity and lets the Military Police arrest offenders. It exists to discourage unfair PvP while protecting people who are defending themselves or their village."),
         ("h", "Crime stat"),
         ("p", "You gain Crime when you kill other players without justification or attack players who are not hostile to you. Your Crime is visible in the right-click menu, so others can see who is a criminal."),
         ("h", "Aggressor status"),
         ("p", "Whoever starts a fight becomes an Aggressor for 1 hour. It is never given to someone defending their own village, and it counts when the game decides whether an action was a crime."),
         ("h", "What is not a crime"),
         ("ul", ["Killing players that have a bounty: bounty hunting is legitimate.",
                 "Defending your village: self-defense is not criminal.",
                 "Fighting in designated PvP zones."]),
         ("p", "Since August 2026, killing Escort NPCs and village wandering NPCs also counts as a crime.")),
     doc(("p", "O Sistema de Crimes registra a atividade criminosa e permite que a Polícia Militar prenda infratores. Ele existe para desencorajar o PvP injusto e proteger quem está se defendendo ou defendendo a vila."),
         ("h", "Crime"),
         ("p", "Você ganha Crime ao matar jogadores sem justificativa ou atacar jogadores que não são hostis a você. O seu Crime aparece no menu do botão direito, então os outros veem quem é criminoso."),
         ("h", "Status de Agressor"),
         ("p", "Quem começa uma briga vira Agressor por 1 hora. Ele nunca é dado a quem defende a própria vila e conta quando o jogo decide se uma ação foi crime."),
         ("h", "O que não é crime"),
         ("ul", ["Matar jogadores que têm recompensa: caçar recompensas é legítimo.",
                 "Defender a sua vila: autodefesa não é crime.",
                 "Lutar em zonas de PvP designadas."]),
         ("p", "Desde agosto de 2026, matar NPCs de escolta e NPCs que vagam pela vila também conta como crime."))),

    ("bounty-system", "combat", 3, "target",
     "Bounty System", "Sistema de Recompensas",
     "How bounties are earned, claimed and lost.",
     "Como as recompensas são ganhas, resgatadas e perdidas.",
     doc(("p", "Bounties are not placed by other players: they come from a bounty collector NPC. There are two separate pools."),
         ("ul", ["Bounty on your head: shown in your character window (N). It grows with the level of every player you kill, and is halved when someone kills you.",
                 "Bounty as your reward: collected from the bounty collector NPC at a bounty station. It grows by half of the head bounty of each player you kill, and stays the same when you die. Press B to open the Bingo Book and see the reward on other players."]),
         ("p", "To earn a bounty by a kill, neither player may have Battle Injuries, both must be level 10 or higher, and only the player who lands the last hit gets it.")),
     doc(("p", "As recompensas não são colocadas por outros jogadores: vêm de um NPC coletor de recompensas. Existem dois valores separados."),
         ("ul", ["Recompensa na sua cabeça: aparece na janela do personagem (N). Ela cresce com o nível de cada jogador que você mata e cai pela metade quando alguém te mata.",
                 "Recompensa como prêmio: coletada com o NPC coletor numa estação de recompensas. Ela cresce em metade da recompensa na cabeça de cada jogador que você mata e continua igual quando você morre. Aperte B para abrir o Bingo Book e ver a recompensa dos outros jogadores."]),
         ("p", "Para ganhar uma recompensa por uma morte, nenhum dos dois pode estar com Ferimentos de Batalha, os dois precisam ter nível 10 ou mais, e só quem dá o último golpe recebe."))),

    ("missing-ninja", "combat", 4, "user-x",
     "Missing Ninja", "Ninja Desertor",
     "How a ninja becomes a rogue, and what it costs.",
     "Como um ninja vira desertor, e o que isso custa.",
     doc(("p", "A Missing Ninja is someone who betrayed an ally by killing allied ninja three times in a War Zone or a Danger Zone (with PvP on), or who was exiled from a village."),
         ("ul", ["You can no longer take daily missions from your old village. Instead you take missions from the Daimyo in Takumi Village, which are more dangerous and usually ask you to kill another ninja.",
                 "You can kill and collect bounties on Leaf, Sand, Mist and other Missing ninja.",
                 "You can rejoin your original village if its Kage grants you a pardon."]),
         ("h", "Rogue titles"),
         ("p", "Your title depends on your bounty: Hermit Ninja at 0, D-rank Criminal from 1 to 100, C-rank from 101 to 449, B-rank from 450 to 999, A-rank from 1000 to 1499 and S-rank from 1500."),
         ("h", "Where you respawn"),
         ("ul", ["Takumi Village: the default, free.",
                 "Kinsen Quarters: you can choose it for a fee of 25 Ryo.",
                 "Cursed Laboratory: free, once you unlock it."])),
     doc(("p", "Ninja Desertor é quem traiu um aliado ao matar ninjas aliados três vezes numa Zona de Guerra ou de Perigo (com PvP ligado), ou quem foi exilado de uma vila."),
         ("ul", ["Você não pega mais missões diárias da sua antiga vila. Em vez disso, pega missões com o Daimyo na Vila Takumi, que são mais perigosas e quase sempre pedem para matar outro ninja.",
                 "Você pode matar e coletar recompensas de ninjas de Folha, Areia, Névoa e de outros Desertores.",
                 "Você pode voltar para a sua vila de origem se o Kage dela te der perdão."]),
         ("h", "Títulos de criminoso"),
         ("p", "O título depende da sua recompensa: Ninja Eremita com 0, Criminoso Rank D de 1 a 100, Rank C de 101 a 449, Rank B de 450 a 999, Rank A de 1000 a 1499 e Rank S a partir de 1500."),
         ("h", "Onde você renasce"),
         ("ul", ["Vila Takumi: o padrão, de graça.",
                 "Kinsen Quarters: dá para escolher pagando 25 Ryo.",
                 "Laboratório Amaldiçoado: de graça, depois de desbloquear."]))),

    ("fainting", "combat", 5, "heart-pulse",
     "Fainting", "Desmaio",
     "What happens when your health runs out, and how another player brings you back.",
     "O que acontece quando a vida acaba e como outro jogador te levanta.",
     doc(("p", "Fainting is what happens when a ninja runs out of health. You do not vanish and you are not out of the fight for good: your character drops where it stood and another player can bring you back on the spot."),
         ("h", "Being revived"),
         ("p", "An ally with the Medical Mastery can revive you with the Mystical Palm technique. It is cast standing still, from one tile away, with a 3 second cooldown, and brings you back on your feet with part of your health and chakra restored. This is the practical reason to travel with a medical ninja."),
         ("h", "If nobody revives you"),
         ("p", "You are moved to your village's hospital and wake up in one of its beds. After fainting you also carry a recovery penalty: see Battle Injuries.")),
     doc(("p", "Desmaiar é o que acontece quando a vida do ninja acaba. Você não some e não está fora da luta para sempre: o personagem cai onde estava e outro jogador pode te levantar na hora."),
         ("h", "Ser reanimado"),
         ("p", "Um aliado com a Maestria Médica pode te reanimar com a técnica Palma Mística. Ela é usada parada, a um tile de distância, com recarga de 3 segundos, e devolve você de pé com parte da vida e do chakra. É por isso que vale andar com um ninja médico."),
         ("h", "Se ninguém te reanimar"),
         ("p", "Você é levado ao hospital da sua vila e acorda numa das camas. Depois de desmaiar você também carrega uma penalidade de recuperação: veja Ferimentos de Batalha."))),

    ("battle-injuries", "combat", 6, "bandage",
     "Battle Injuries", "Ferimentos de Batalha",
     "The recovery penalty after fainting, and how to shorten it.",
     "A penalidade de recuperação depois de desmaiar e como encurtá-la.",
     doc(("p", "Battle Injuries are the recovery penalty you carry after fainting. They are measured in seconds, and the length depends on the hospitalization plan you pick on the panel that appears when you go down."),
         ("ul", ["Hospitalization plans cost Ryo but speed up recovery: paying skips most of the wait.",
                 "The Home option matches the shortest paid plan (240 seconds) and costs no Ryo, so a ninja who owns a house never needs to buy the cheaper plan.",
                 "Since update v6.0.0.3 there are several kinds of battle injury, there is a 25% chance to faint with none at all, and different kinds stack, so fainting again and again has a downside."]),
         ("p", "Prices and times on the panel may change with the game, so treat any figure as an example.")),
     doc(("p", "Ferimentos de Batalha são a penalidade de recuperação que você carrega depois de desmaiar. Eles são medidos em segundos e a duração depende do plano de hospitalização escolhido no painel que aparece quando você cai."),
         ("ul", ["Os planos de hospitalização custam Ryo mas aceleram a recuperação: pagar pula a maior parte da espera.",
                 "A opção Casa iguala o plano pago mais curto (240 segundos) e não custa Ryo, então quem tem casa nunca precisa comprar o plano mais barato.",
                 "Desde a atualização v6.0.0.3 existem vários tipos de ferimento, há 25% de chance de desmaiar sem nenhum e os tipos se acumulam, então desmaiar várias vezes seguidas tem um custo."]),
         ("p", "Preços e tempos no painel podem mudar com o jogo, então trate qualquer valor como exemplo."))),

    ("teams", "combat", 7, "users",
     "Teams", "Equipes",
     "The party system: shared experience and the team bonus.",
     "O sistema de grupo: experiência compartilhada e bônus de equipe.",
     doc(("p", "Nin Online is a dangerous world and, while you can play most of it solo, it is advised to team up."),
         ("ul", ["Add someone by right-clicking them and pressing the Team button on their profile, or with the /invite command. Only the team leader can add people.",
                 "Experience from kills is divided equally among team members on the same map, and a hefty bonus is added on top of the split, growing with every extra member.",
                 "To hand leadership to someone else, press the blue bell icon next to their name on the Team HUD.",
                 "Use /t to talk to your team and /leave to leave it."])),
     doc(("p", "Nin Online é um mundo perigoso e, embora dê para jogar quase tudo sozinho, o ideal é formar equipe."),
         ("ul", ["Adicione alguém clicando nele com o botão direito e apertando o botão Equipe no perfil, ou com o comando /invite. Só o líder da equipe pode adicionar pessoas.",
                 "A experiência das mortes é dividida igualmente entre os membros que estão no mesmo mapa e um bônus grande é somado depois da divisão, crescendo a cada membro extra.",
                 "Para passar a liderança, aperte o ícone de sino azul ao lado do nome da pessoa no HUD da equipe.",
                 "Use /t para falar com a equipe e /leave para sair dela."]))),

    ("levels", "progression", 1, "trending-up",
     "Levels", "Níveis",
     "What your level gates and unlocks.",
     "O que o seu nível libera e bloqueia.",
     doc(("p", "Level decides a large part of the game: the missions you can take, the techniques you can learn, the equipment you can wear and how many masteries you can have."),
         ("ul", ["Every level gives you stat points to spend on your five stats.",
                 "At level 10 you must choose your first mastery, and your stats are reset. Everyone who chooses a mastery can claim a free Sealable Scroll I from the scroll shop.",
                 "At level 50 you choose your second mastery.",
                 "The current level cap is 70. The cap applies to everyone; story arcs are optional content.",
                 "The experience needed for each level keeps growing as you climb."])),
     doc(("p", "O nível decide boa parte do jogo: as missões que você pode pegar, as técnicas que pode aprender, os equipamentos que pode vestir e quantas maestrias pode ter."),
         ("ul", ["Cada nível dá pontos de atributo para gastar nos seus cinco atributos.",
                 "No nível 10 você precisa escolher a primeira maestria, e seus atributos são resetados. Quem escolhe uma maestria pode pegar um Pergaminho Selável I de graça na loja de pergaminhos.",
                 "No nível 50 você escolhe a segunda maestria.",
                 "O nível máximo atual é 70. Ele vale para todos; os arcos de história são conteúdo opcional.",
                 "A experiência necessária para cada nível continua crescendo conforme você sobe."]))),

    ("stats", "progression", 2, "bar-chart",
     "Statistics", "Atributos",
     "What Strength, Agility, Intellect, Chakra and Fortitude actually do.",
     "O que Força, Agilidade, Intelecto, Chakra e Fortitude realmente fazem.",
     doc(("p", "Every ninja invests points in five stats each time they level up."),
         ("ul", ["Strength raises your weapon damage with swords and kunai, and the damage of Weapon mastery jutsu.",
                 "Agility raises your taijutsu damage, lowers jutsu cast time and raises attack speed.",
                 "Intellect raises the effectiveness of ninjutsu and genjutsu, and scales shuriken damage.",
                 "Chakra raises your maximum chakra (5 per point), which is spent casting ninjutsu; a high amount also lets you detect hidden enemies.",
                 "Fortitude raises your maximum health."]),
         ("p", "Equipment can add to these stats too. Read this before spending points: choosing a mastery at level 10 resets them once, but the mastery itself is permanent.")),
     doc(("p", "Todo ninja investe pontos em cinco atributos a cada vez que sobe de nível."),
         ("ul", ["Força aumenta o dano de armas com espadas e kunais e o dano dos jutsus da Maestria de Armas.",
                 "Agilidade aumenta o dano de taijutsu, reduz o tempo de conjuração dos jutsus e aumenta a velocidade de ataque.",
                 "Intelecto aumenta a eficácia de ninjutsu e genjutsu e o dano de shurikens.",
                 "Chakra aumenta o seu chakra máximo (5 por ponto), gasto ao usar ninjutsu; ter bastante também permite detectar inimigos escondidos.",
                 "Fortitude aumenta a sua vida máxima."]),
         ("p", "Equipamentos também podem somar nesses atributos. Leia isto antes de gastar pontos: escolher uma maestria no nível 10 reseta os atributos uma vez, mas a maestria em si é permanente."))),

    ("charging-chakra", "progression", 3, "zap",
     "Charging Chakra", "Carregar Chakra",
     "Chakra does not regenerate on its own: hold C to charge it.",
     "O chakra não regenera sozinho: segure C para carregá-lo.",
     doc(("p", "Chakra Charge is a technique every shinobi knows from the start. Hold the C key while standing still and it regenerates one tenth of your chakra every second until it is full."),
         ("ul", ["You have to stand still, or the technique will not work.",
                 "If you are attacked while charging, the charge is cancelled.",
                 "It has a short cooldown and cannot be used while doing certain other actions."])),
     doc(("p", "Carregar Chakra é uma técnica que todo shinobi conhece desde o começo. Segure a tecla C parado e ela regenera um décimo do seu chakra por segundo até encher."),
         ("ul", ["Você precisa ficar parado, senão a técnica não funciona.",
                 "Se você for atacado enquanto carrega, a carga é cancelada.",
                 "Ela tem uma recarga curta e não pode ser usada durante certas outras ações."]))),

    ("jutsu-slots", "progression", 4, "layout-grid",
     "Jutsu Slots", "Espaços de Jutsu",
     "How many jutsu you can know at once.",
     "Quantos jutsus você pode conhecer ao mesmo tempo.",
     doc(("p", "Jutsu slots cap how many jutsu you can know at once. You start with 5 slots at level 1 and gain 1 more slot every 5 levels, so at level 25 you have 10."),
         ("p", "If you have no free slot you cannot learn another jutsu until you forget one: right-click it in the Jutsus menu to forget it.")),
     doc(("p", "Os espaços de jutsu limitam quantos jutsus você pode conhecer ao mesmo tempo. Você começa com 5 espaços no nível 1 e ganha mais 1 a cada 5 níveis, então no nível 25 você tem 10."),
         ("p", "Se não houver espaço livre, você não aprende outro jutsu até esquecer um: clique com o botão direito nele no menu de Jutsus para esquecê-lo."))),

    ("titles", "progression", 5, "award",
     "Titles", "Títulos",
     "Cosmetic titles shown above your name.",
     "Títulos cosméticos mostrados acima do seu nome.",
     doc(("p", "Titles are cosmetic rewards for completing tasks or reaching goals. You can display one above your name tag. They come in a few kinds:"),
         ("ul", ["Quest titles, such as Ninja Beast Slayer, Koji-Co Champion, Ronin, Hero Of The Toads and Honorable Rebel.",
                 "Village titles for people in village roles, such as Kage Council Member, Medical Director, Police Chief and ANBU Leader.",
                 "Rogue titles for Missing Ninja, from D-Rank to S-Rank Criminal.",
                 "War Event titles, bought in the War Event Shop (for example War Lord).",
                 "Special titles, granted by a Game Master for tournaments and other challenges."])),
     doc(("p", "Títulos são recompensas cosméticas por cumprir tarefas ou atingir objetivos. Você pode exibir um acima do nome. Existem alguns tipos:"),
         ("ul", ["Títulos de missão, como Ninja Beast Slayer, Koji-Co Champion, Ronin, Hero Of The Toads e Honorable Rebel.",
                 "Títulos de vila para quem tem cargos na vila, como Kage Council Member, Medical Director, Police Chief e ANBU Leader.",
                 "Títulos de criminoso para Ninjas Desertores, de Criminoso Rank D a Rank S.",
                 "Títulos do Evento de Guerra, comprados na Loja do Evento de Guerra (por exemplo War Lord).",
                 "Títulos especiais, dados por um Game Master em torneios e outros desafios."]))),

    ("controls", "interface", 1, "keyboard",
     "Controls", "Controles",
     "Movement, keybindings and the keys worth knowing.",
     "Movimento, atalhos e as teclas que vale conhecer.",
     doc(("p", "Keybindings can be changed in the client under Settings, along with the resolution."),
         ("ul", ["Walk with the arrow keys, WASD or the mouse. Hold Shift to run.",
                 "Face a direction without moving with Home, Insert, End and Page Down, handy when talking to an NPC.",
                 "Hold C to charge chakra, press P to toggle PvP mode, N opens your character window and B opens the Bingo Book.",
                 "Since update v6.0.0.8 every window can be used without a mouse: arrows, WASD or the stick move around, Enter, Space or A selects, Q/E or Tab switch tabs, Page Up/Down change pages and Escape backs out and then closes the window.",
                 "In the same update Interact moved from E to F, Friends moved from F to U and R opens your target's Ninja Card."])),
     doc(("p", "Os atalhos podem ser alterados no cliente, em Configurações, junto com a resolução."),
         ("ul", ["Ande com as setas, WASD ou o mouse. Segure Shift para correr.",
                 "Vire para uma direção sem andar com Home, Insert, End e Page Down, útil para falar com um NPC.",
                 "Segure C para carregar chakra, aperte P para ligar/desligar o PvP, N abre a janela do personagem e B abre o Bingo Book.",
                 "Desde a atualização v6.0.0.8 toda janela pode ser usada sem mouse: setas, WASD ou o direcional movem, Enter, Espaço ou A seleciona, Q/E ou Tab trocam de aba, Page Up/Down trocam de página e Escape volta e depois fecha a janela.",
                 "Na mesma atualização, Interagir mudou de E para F, Amigos mudou de F para U e R abre a Ficha Ninja do alvo."]))),

    ("commands", "interface", 2, "message-square",
     "Chat commands", "Comandos de chat",
     "Chat, team and emote commands.",
     "Comandos de chat, de equipe e de emotes.",
     doc(("ul", ["/v message: broadcast to your whole village (from the Aviary).",
                 "/t message: talk to your team.",
                 "/e message: an emote line, used for roleplay.",
                 "Private message: type the player's name followed by the message, or use /r to reply.",
                 "/invite name (or /invite while targeting someone) invites a player to your team, and /leave leaves your team.",
                 "/emotes lists the emote commands, such as /wave, /clap, /cry and /gg."]),
         ("p", "Typing :) :D <3 and similar turns them into emoji in chat, and commands and player names are suggested as you type: Up and Down pick one, Tab or Enter takes it.")),
     doc(("ul", ["/v mensagem: avisa a vila inteira (a partir do Aviário).",
                 "/t mensagem: fala com a sua equipe.",
                 "/e mensagem: uma linha de emote, usada em roleplay.",
                 "Mensagem privada: digite o nome do jogador seguido da mensagem, ou use /r para responder.",
                 "/invite nome (ou /invite mirando em alguém) convida um jogador para a equipe, e /leave sai da equipe.",
                 "/emotes lista os comandos de emote, como /wave, /clap, /cry e /gg."]),
         ("p", "Digitar :) :D <3 e parecidos vira emoji no chat, e comandos e nomes de jogadores são sugeridos enquanto você digita: Cima e Baixo escolhem, Tab ou Enter aceita."))),

    ("making-ryo", "economy", 1, "coins",
     "Making Ryo", "Como ganhar Ryo",
     "The ways to earn the in-game currency.",
     "As formas de ganhar a moeda do jogo.",
     doc(("p", "Ryo buys gear, tools, house rent, jutsu scrolls and everything that is not a Cash Shop cosmetic. It is separate from Nin Credits, which are bought with real money. The main ways to earn it:"),
         ("ul", ["Daily missions: the reliable floor. You can start up to 4 per day, so pick the ones that pay most for your level.",
                 "Selling mob drops: every drop has a vendor value on the monster's page.",
                 "Gathering and selling materials, and crafting: see Proficiencies.",
                 "Bounties: see the Bounty System.",
                 "Player shops, which let you sell while offline, and trading with other players."])),
     doc(("p", "O Ryo compra equipamentos, ferramentas, aluguel de casa, pergaminhos de jutsu e tudo que não é cosmético da Cash Shop. Ele é separado dos Nin Credits, comprados com dinheiro de verdade. As principais formas de ganhar:"),
         ("ul", ["Missões diárias: o piso confiável. Dá para começar até 4 por dia, então escolha as que mais pagam no seu nível.",
                 "Vender drops de monstros: todo drop tem um valor de loja na página do monstro.",
                 "Coletar e vender materiais, e criar itens: veja Proficiências.",
                 "Recompensas: veja o Sistema de Recompensas.",
                 "Lojas de jogador, que permitem vender mesmo offline, e trocas com outros jogadores."]))),
]


async def main() -> None:
    """Simula (ou grava com --aplicar) a criacao dos artigos do Guia."""
    ap = argparse.ArgumentParser(description="Cria os artigos do Guia (Zonas, Crime, Equipes, Controles...).")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--publicar", action="store_true", help="cria ja' publicados (padrao: rascunho, para revisar antes)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    situacao = ContentStatus.PUBLISHED if args.publicar else ContentStatus.DRAFT
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'} | situacao: {situacao.value}")

    async with AsyncSessionLocal() as db:
        existentes = set((await db.execute(select(GuideArticle.id))).scalars().all())
        novos = 0
        for id_, secao, posicao, icone, titulo, titulo_pt, resumo, resumo_pt, corpo, corpo_pt in ARTIGOS:
            if id_ in existentes:
                print(f"  {id_:<18} ja existe (nao mexido)")
                continue
            print(f"  {id_:<18} {secao:<12} {titulo}")
            novos += 1
            if args.aplicar:
                db.add(GuideArticle(id=id_, section=secao, position=posicao, icon=icone, title=titulo, title_pt=titulo_pt, summary=resumo,
                                    summary_pt=resumo_pt, body=corpo, body_pt=corpo_pt, status=situacao))
        if args.aplicar:
            await db.commit()
    print(f"\nArtigos novos: {novos}")
    print("Gravado." if args.aplicar else "Simulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
