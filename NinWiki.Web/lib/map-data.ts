/**
 * Summary: dados dos pins interativos exibidos sobre o mapa SVG.
 *
 * As coordenadas são percentuais, não pixels. Isso faz os pins acompanharem
 * o redimensionamento da imagem em telas diferentes. Para adicionar um novo
 * ponto, basta criar outro objeto com `x`, `y`, `title` e `description`.
 */

export interface MapMarker {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
  color: string;
}

/**
 * Pontos iniciais inspirados no formato do mapa de referência.
 * Eles são exemplos editáveis; depois podem vir da API.
 */
export const mapMarkers: MapMarker[] = [
  {
    id: 'hyaketsu-prison',
    title: 'Prisão de Hyaketsu',
    description: 'Uma área de exploração localizada na região noroeste.',
    x: 19,
    y: 46,
    color: '#ef4444',
  },
  {
    id: 'kinsen-district',
    title: 'Bairro Kinsen',
    description: 'Região urbana conectada às rotas do País do Fogo.',
    x: 30,
    y: 51,
    color: '#f59e0b',
  },
  {
    id: 'leaf-village',
    title: 'Aldeia da Folha',
    description: 'Centro principal da região e uma das grandes vilas shinobi.',
    x: 49,
    y: 50,
    color: '#22c55e',
  },
  {
    id: 'asoki-village',
    title: 'Vila Asoki',
    description: 'Ponto de passagem ao sul das rotas centrais.',
    x: 58,
    y: 68,
    color: '#38bdf8',
  },
  {
    id: 'sand-village',
    title: 'Aldeia da Areia',
    description: 'Vila localizada na área desértica a sudoeste.',
    x: 17,
    y: 84,
    color: '#facc15',
  },
  {
    id: 'takumi-village',
    title: 'Aldeia Takumi',
    description: 'Área conhecida por seus ferreiros e equipamentos.',
    x: 54,
    y: 89,
    color: '#a855f7',
  },
  {
    id: 'mist-village',
    title: 'Aldeia da Névoa',
    description: 'Território insular localizado no extremo leste do mapa.',
    x: 91,
    y: 65,
    color: '#06b6d4',
  },
];