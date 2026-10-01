// components/ui/collapsible.tsx
// Wrapper fino do Radix UI Collapsible: uma secao que expande/recolhe (versao
// mais simples do Accordion, sem multiplas secoes coordenadas).

'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
