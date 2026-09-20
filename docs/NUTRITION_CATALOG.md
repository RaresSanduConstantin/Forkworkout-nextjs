# ForkWorkout offline nutrition catalog

ForkWorkout ships a compact food catalog at `public/json/foods.json`. The PWA
service worker precaches this file so food search works without a network
connection.

## Source and licensing

The generated records come from the USDA FoodData Central SR Legacy April 2018
release. SR Legacy is the final release of that data type and is well suited to
generic foods and preparation variants. USDA FoodData Central data is public
domain under CC0; the app retains a direct FoodData Central reference for each
generated record and identifies FoodData Central as its source.

- Dataset downloads: https://fdc.nal.usda.gov/download-datasets/
- Data documentation: https://fdc.nal.usda.gov/data-documentation/

Do not add the raw USDA archive to `public/` or Git. The archive expands into
multiple relational CSV tables totaling roughly 40 MB. The generated app file
contains only the fields ForkWorkout needs and is roughly 0.5 MB uncompressed.

## Regenerate automatically

From the repository root:

```sh
npm run nutrition:catalog
```

The generator downloads the official SR Legacy ZIP to the operating system's
temporary directory, extracts it, preserves the hand-curated records and
Romanian aliases already in `foods.json`, and deterministically writes 1,000
records back to `public/json/foods.json`.

## Use a manually downloaded archive

Download and extract the **SR Legacy CSV** archive from FoodData Central. Then
pass the extracted directory to the generator:

```sh
npm run nutrition:catalog -- --source /absolute/path/to/extracted-folder
```

An alternate size can be generated with `--limit`, between 100 and 5,000:

```sh
npm run nutrition:catalog -- --source /absolute/path/to/extracted-folder --limit 1200
```

After regeneration, run `npm test` and `npm run build`. The production build
output should list `/json/foods.json` in `public/sw.js`'s precache manifest.

## Selection rules

The generator:

- includes generic dairy, meat, fish, grains, legumes, fruit, vegetables,
  fats, baked goods, drinks, spices, and related foods;
- excludes baby food, fast food, restaurant food, alcohol, quality-control
  materials, the branded-food category, and recognizable legacy brands;
- requires calories, protein, carbohydrates, and fat;
- includes fibre, sugar, and sodium when available;
- balances records across the included USDA categories;
- stores all nutrient values per 100 g;
- retains the curated starter foods first so their clearer names and Romanian
  aliases rank ahead of generated alternatives.

Generated foods use USDA descriptions. Romanian aliases are curated manually;
they are not machine-translated during generation.
