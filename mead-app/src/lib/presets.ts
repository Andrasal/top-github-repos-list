/** Style presets — SPEC §19.3. Defined per 10 L of must; scaled to the user's batch on apply. */
import type { Recipe } from './recipe';

export interface Preset {
  id: string;
  emoji: string;
  name: string;
  blurb: string;
  recipe: Pick<Recipe, 'honeys' | 'sugars' | 'fruits' | 'spices' | 'yeastId' | 'targetFg'> & { name: string };
}

const h = (honeyId: string, massKg: number, uid = 'h1') => ({ uid, honeyId, massKg });
const f = (fruitId: string, massKg: number, stage: 'primary' | 'secondary' = 'primary', uid = `f-${fruitId}`) => ({ uid, fruitId, massKg, stage });
const s = (spiceId: string, grams: number) => ({ uid: `s-${spiceId}`, spiceId, grams });

export const PRESETS: Preset[] = [
  { id: 'traditional', emoji: '🍯', name: 'Semi-sweet traditional', blurb: 'Honey, water and yeast. The honey varietal is the star.',
    recipe: { name: 'Orange Blossom Traditional', honeys: [h('orange-blossom', 3.2)], sugars: [], fruits: [], spices: [], yeastId: 'd47', targetFg: 1.012 } },
  { id: 'hydromel', emoji: '🫧', name: 'Session hydromel', blurb: 'Light, about 6 % and easy to drink. Great carbonated.',
    recipe: { name: 'Sparkling Clover Hydromel', honeys: [h('clover', 1.7)], sugars: [], fruits: [], spices: [s('orange-zest', 8)], yeastId: 'qa23', targetFg: 1.006 } },
  { id: 'cherry-vanilla', emoji: '🍒', name: 'Cherry-vanilla dessert', blurb: 'Rich and sweet, with tart cherry and vanilla. The crowd-pleaser.',
    recipe: { name: 'Black Forest Melomel', honeys: [h('wildflower', 3.6)], sugars: [], fruits: [f('tart-cherry', 2.5)], spices: [s('vanilla', 7), s('cacao', 30)], yeastId: 'k1v1116', targetFg: 1.025 } },
  { id: 'cyser', emoji: '🍏', name: 'Spiced cyser', blurb: 'Apple juice and honey with a little cinnamon. Autumn in a glass.',
    recipe: { name: 'Harvest Cyser', honeys: [h('wildflower', 2)], sugars: [], fruits: [f('apple-juice', 5)], spices: [s('cinnamon', 4)], yeastId: '71b', targetFg: 1.008 } },
  { id: 'pyment', emoji: '🍇', name: 'Oaked pyment', blurb: 'A honey-and-grape hybrid that drinks like a rich red wine.',
    recipe: { name: 'Oaked Pyment', honeys: [h('clover', 2.4)], sugars: [], fruits: [f('grape', 3)], spices: [s('oak', 25)], yeastId: 'rc212', targetFg: null } },
  { id: 'chai', emoji: '🫖', name: 'Chai metheglin', blurb: 'Warm spice, built with one lead spice and supporting notes.',
    recipe: { name: 'Chai Metheglin', honeys: [h('wildflower', 3.1)], sugars: [], fruits: [], spices: [s('cinnamon', 4), s('cardamom', 1.5), s('ginger', 15), s('clove', 0.15), s('black-pepper', 0.4)], yeastId: 'k1v1116', targetFg: 1.012 } },
  { id: 'elderflower-pear', emoji: '🌼', name: 'Elderflower & pear', blurb: 'Delicate and floral, a summer mead. Fruit goes in secondary for aroma.',
    recipe: { name: 'Hedgerow Summer Mead', honeys: [h('acacia', 2.6)], sugars: [], fruits: [f('pear', 2.5, 'secondary')], spices: [s('elderflower', 8)], yeastId: 'qa23', targetFg: 1.008 } },
  { id: 'dark-bramble', emoji: '🫐', name: 'Buckwheat bramble', blurb: 'Dark honey, blackberry and oak. Bold, and it ages beautifully.',
    recipe: { name: 'Buckwheat Bramble', honeys: [h('buckwheat', 1.5), h('wildflower', 1.5, 'h2')], sugars: [], fruits: [f('blackberry', 2.6)], spices: [s('oak', 20)], yeastId: 'rc212', targetFg: 1.01 } },
  { id: 'hibiscus', emoji: '🌺', name: 'Hibiscus-ginger', blurb: 'Ruby red, tart and spicy.',
    recipe: { name: 'Hibiscus Ginger Mead', honeys: [h('wildflower', 2.8)], sugars: [], fruits: [], spices: [s('hibiscus', 12), s('ginger', 30)], yeastId: '71b', targetFg: 1.01 } },
  { id: 'butterfly-pea', emoji: '🦋', name: 'Colour-changer', blurb: 'Butterfly pea makes it violet-blue. Add citrus in the glass and it turns pink.',
    recipe: { name: 'Butterfly Pea Hydromel', honeys: [h('clover', 1.8)], sugars: [], fruits: [], spices: [s('butterfly-pea', 5), s('lemongrass', 20)], yeastId: 'qa23', targetFg: 1.008 } },
];

export const PRESET_BASE_VOLUME_L = 10;
