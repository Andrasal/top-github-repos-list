import type { Stave } from './types';

/**
 * Icelandic magical staves (galdrastafir). These are early-modern (17th–19th c.),
 * not Viking-age. Only staves with a defensible geometric reconstruction are
 * drawable; the rest are encyclopedia entries only.
 */
export const STAVES: Stave[] = [
  {
    id: 'aegishjalmur',
    name: 'Ægishjálmur',
    translation: 'Helm of Awe / Helm of Terror',
    sources: 'Several 17th–19th c. Icelandic grimoires, among them the Huld manuscript (ÍB 383 4to, Geir Vigfússon, 1860). The name echoes the ægishjálmr of Fáfnismál st. 16–17 and Völsunga saga.',
    history:
      'In the Eddic poems the ægishjálmr is Fáfnir\'s terror-helm, an object or power that cows all living things, not a drawn sign. ' +
      'The drawn stave, with eight arms ending in tridents and crossbars, is an early-modern Icelandic development. Manuscript versions differ in arm detail.',
    purpose: 'To strike fear into enemies and protect the bearer. One recorded instruction is to press it in lead between the brows.',
    layer: 'attested',
    helmPreset: 'aegishjalmur',
  },
  {
    id: 'vegvisir',
    name: 'Vegvísir',
    translation: 'Way-shower / Signpost',
    sources: 'Huld manuscript (ÍB 383 4to, Geir Vigfússon, 1860).',
    history:
      'It is known from a single 19th-c. manuscript. Its eight arms each carry a different terminal, so the stave has only skeleton symmetry (spokes and hub), not full radial symmetry. That is historically correct.',
    purpose: '"If this sign is carried, one will never lose one\'s way in storms or bad weather, even when the way is not known."',
    layer: 'attested',
    helmPreset: 'vegvisir',
  },
  {
    id: 'gapaldur-ginfaxi',
    name: 'Gapaldur & Ginfaxi',
    translation: 'Wrestling staves',
    sources: 'Icelandic grimoire tradition (17th–19th c.).',
    history: 'This is a pair of staves for glíma (Icelandic wrestling). Ginfaxi goes under the toes of the left foot and Gapaldur under the heel of the right.',
    purpose: 'Victory in wrestling.',
    layer: 'attested',
  },
  {
    id: 'ottastafur',
    name: 'Óttastafur',
    translation: 'Fear stave',
    sources: 'Icelandic grimoire tradition (17th–19th c.).',
    history: 'This is one of several staves meant to frighten or confound an opponent.',
    purpose: 'To instil fear in an enemy.',
    layer: 'attested',
  },
  {
    id: 'lasabrjotur',
    name: 'Lásabrjótur',
    translation: 'Lock-breaker',
    sources: 'Icelandic grimoire tradition (17th–19th c.).',
    history: 'In the tradition it is laid against a lock to open it without a key.',
    purpose: 'Opening locks.',
    layer: 'attested',
  },
  {
    id: 'draumstafir',
    name: 'Draumstafir',
    translation: 'Dream staves',
    sources: 'Icelandic grimoire tradition (17th–19th c.).',
    history: 'These staves are placed under the pillow to dream of what one wishes to know.',
    purpose: 'Prophetic or desired dreams.',
    layer: 'attested',
  },
  {
    id: 'kaupaloki',
    name: 'Kaupaloki',
    translation: 'Trade-closer',
    sources: 'Icelandic grimoire tradition (17th–19th c.).',
    history: 'This stave is carried when trading.',
    purpose: 'Success in bargaining and trade.',
    layer: 'attested',
  },
  {
    id: 'hulinhjalmur',
    name: 'Hulinhjálmur',
    translation: 'Helm of concealment',
    sources: 'Icelandic grimoire tradition (17th–19th c.).',
    history: 'This is a "helm" (hjálmur) stave like Ægishjálmur, meant to make the bearer unseen.',
    purpose: 'Invisibility and concealment.',
    layer: 'attested',
  },
];
