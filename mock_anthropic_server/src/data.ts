export interface MockRecipe {
  title: string;
  description: string;
  category: string;
  servings: number;
  ingredients: { name: string; amount: number | null; unit: string | null }[];
  steps: string[];
}

export const GOULASH: MockRecipe = {
  title: 'Gulyásleves',
  description:
    'Klasszikus magyar gulyásleves marhahússal, burgonyával és bőséges pirospaprikával.',
  category: 'Leves',
  servings: 4,
  ingredients: [
    { name: 'marhalábszár', amount: 500, unit: 'g' },
    { name: 'vöröshagyma', amount: 2, unit: 'db' },
    { name: 'pirospaprika', amount: 2, unit: 'evőkanál' },
    { name: 'burgonya', amount: 400, unit: 'g' },
    { name: 'sárgarépa', amount: 2, unit: 'db' },
    { name: 'só', amount: null, unit: null },
  ],
  steps: [
    'Pirítsd meg a felkockázott vöröshagymát kevés zsíron.',
    'Add hozzá a felkockázott marhahúst, és pirítsd fehéredésig.',
    'Szórd meg pirospaprikával, öntsd fel vízzel, és főzd egy órán át.',
    'Add hozzá a felkockázott burgonyát és sárgarépát, majd főzd puhára.',
    'Sózd ízlés szerint, és forrón tálald.',
  ],
};

export const STRUDEL: MockRecipe = {
  title: 'Almás rétes',
  description: 'Ropogós réteslapok között fahéjas almatöltelék, ahogy a nagymama készítette.',
  category: 'Sütemény',
  servings: 8,
  ingredients: [
    { name: 'réteslap', amount: 6, unit: 'db' },
    { name: 'alma', amount: 1, unit: 'kg' },
    { name: 'cukor', amount: 100, unit: 'g' },
    { name: 'fahéj', amount: 1, unit: 'teáskanál' },
    { name: 'olvasztott vaj', amount: 80, unit: 'g' },
  ],
  steps: [
    'Reszeld le az almát, és keverd össze a cukorral meg a fahéjjal.',
    'Kend meg a réteslapokat olvasztott vajjal, és rétegezd egymásra.',
    'Oszlasd el az almatölteléket, és tekerd fel a rétest.',
    'Süsd 180 fokon 35 percig, amíg aranybarna nem lesz.',
  ],
};
