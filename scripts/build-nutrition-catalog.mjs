#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { execFileSync } from "node:child_process";

const USDA_ARCHIVE_URL =
  "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip";
const DEFAULT_OUTPUT = "public/json/foods.json";
const DEFAULT_LIMIT = 1000;
const INCLUDED_CATEGORY_IDS = new Set([
  "1", "2", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14",
  "15", "16", "17", "18", "19", "20",
]);
const NUTRIENT_IDS = new Set(["1003", "1004", "1005", "1008", "1079", "1093", "2000", "2047", "2048"]);
const EXCLUDED_DESCRIPTION =
  /babyfood|infant formula|alcoholic beverage|quality control|pillsbury|kraft foods|mcdonald|burger king|wendy's|kellogg|general mills|campbell|nabisco|keebler|george weston/i;

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

async function eachCsvRow(filePath, handler) {
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let headers;
  for await (const line of lines) {
    const values = parseCsvLine(line);
    if (!headers) {
      headers = values;
      continue;
    }
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    handler(row);
  }
}

async function findFile(directory, filename) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFile(entryPath, filename);
      if (nested) return nested;
    } else if (entry.name === filename) {
      return entryPath;
    }
  }
  return null;
}

async function downloadSource() {
  const workingDirectory = await mkdtemp(join(tmpdir(), "forkworkout-usda-sr-"));
  const archivePath = join(workingDirectory, basename(USDA_ARCHIVE_URL));
  const response = await fetch(USDA_ARCHIVE_URL);
  if (!response.ok) throw new Error(`USDA download failed with HTTP ${response.status}`);
  await writeFile(archivePath, Buffer.from(await response.arrayBuffer()));
  execFileSync("unzip", ["-q", "-o", archivePath, "-d", workingDirectory]);
  return workingDirectory;
}

function normalizedKey(value) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function candidateScore(description) {
  let score = description.length;
  if (/raw|cooked|boiled|roasted|baked|grilled/i.test(description)) score -= 10;
  if (/without salt|no salt/i.test(description)) score -= 3;
  if (/prepared with|added nutrients|commercially prepared/i.test(description)) score += 20;
  return score;
}

function toCatalogFood(candidate) {
  const parts = candidate.description.split(",").map((part) => part.trim()).filter(Boolean);
  const energy = candidate.nutrients["1008"] ?? candidate.nutrients["2047"] ?? candidate.nutrients["2048"];
  const nutrients = {
    caloriesKcal: round(energy),
    proteinG: round(candidate.nutrients["1003"]),
    carbsG: round(candidate.nutrients["1005"]),
    fatG: round(candidate.nutrients["1004"]),
  };
  if (candidate.nutrients["1079"] !== undefined) nutrients.fibreG = round(candidate.nutrients["1079"]);
  if (candidate.nutrients["2000"] !== undefined) nutrients.sugarG = round(candidate.nutrients["2000"]);
  if (candidate.nutrients["1093"] !== undefined) nutrients.sodiumMg = round(candidate.nutrients["1093"], 0);
  return {
    id: `usda-${candidate.fdcId}`,
    name: parts.shift() ?? candidate.description,
    aliases: [],
    ...(parts.length > 0 ? { variant: parts.join(", ") } : {}),
    basisAmount: 100,
    basisUnit: "g",
    nutrients,
    source: "builtin",
    sourceReference: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${candidate.fdcId}/nutrients`,
  };
}

async function main() {
  const outputPath = resolve(option("output", DEFAULT_OUTPUT));
  const existingPath = resolve(option("existing", outputPath));
  const limit = Number.parseInt(option("limit", String(DEFAULT_LIMIT)), 10);
  if (!Number.isInteger(limit) || limit < 100 || limit > 5000) {
    throw new Error("--limit must be an integer between 100 and 5000");
  }

  const sourceDirectory = option("source", null) ?? (await downloadSource());
  const foodPath = await findFile(resolve(sourceDirectory), "food.csv");
  const nutrientPath = await findFile(resolve(sourceDirectory), "food_nutrient.csv");
  if (!foodPath || !nutrientPath) {
    throw new Error("The source directory must contain USDA food.csv and food_nutrient.csv files");
  }

  let existingCatalog = { foods: [] };
  try {
    existingCatalog = JSON.parse(await readFile(existingPath, "utf8"));
  } catch {
    // Starting without a curated catalog is supported.
  }
  const curatedFoods = Array.isArray(existingCatalog.foods)
    ? existingCatalog.foods.filter(
        (food) =>
          food &&
          typeof food === "object" &&
          Array.isArray(food.aliases) &&
          food.aliases.length > 0
      )
    : [];
  const curatedIds = new Set(curatedFoods.map((food) => food.id));
  const curatedNames = new Set(
    curatedFoods.map((food) => normalizedKey(`${food.name} ${food.variant ?? ""}`))
  );

  const candidates = new Map();
  await eachCsvRow(foodPath, (row) => {
    if (
      !INCLUDED_CATEGORY_IDS.has(row.food_category_id) ||
      !row.fdc_id ||
      !row.description ||
      EXCLUDED_DESCRIPTION.test(row.description)
    ) return;
    candidates.set(row.fdc_id, {
      fdcId: row.fdc_id,
      categoryId: row.food_category_id,
      description: row.description,
      nutrients: {},
    });
  });

  await eachCsvRow(nutrientPath, (row) => {
    const candidate = candidates.get(row.fdc_id);
    if (!candidate || !NUTRIENT_IDS.has(row.nutrient_id)) return;
    const amount = Number.parseFloat(row.amount);
    if (Number.isFinite(amount) && amount >= 0) candidate.nutrients[row.nutrient_id] = amount;
  });

  const grouped = new Map();
  for (const candidate of candidates.values()) {
    const nutrients = candidate.nutrients;
    const energy = nutrients["1008"] ?? nutrients["2047"] ?? nutrients["2048"];
    if (
      energy === undefined ||
      nutrients["1003"] === undefined ||
      nutrients["1004"] === undefined ||
      nutrients["1005"] === undefined
    ) continue;
    const food = toCatalogFood(candidate);
    if (curatedIds.has(food.id)) continue;
    const nameKey = normalizedKey(`${food.name} ${food.variant ?? ""}`);
    if (curatedNames.has(nameKey)) continue;
    const category = grouped.get(candidate.categoryId) ?? [];
    category.push(candidate);
    grouped.set(candidate.categoryId, category);
  }
  for (const category of grouped.values()) {
    category.sort(
      (left, right) =>
        candidateScore(left.description) - candidateScore(right.description) ||
        Number(left.fdcId) - Number(right.fdcId)
    );
  }

  const generated = [];
  const categoryIds = Array.from(grouped.keys()).sort((left, right) => Number(left) - Number(right));
  const categoryIndexes = new Map(categoryIds.map((categoryId) => [categoryId, 0]));
  const generatedTarget = Math.max(0, limit - curatedFoods.length);
  while (generated.length < generatedTarget) {
    let addedThisRound = false;
    for (const categoryId of categoryIds) {
      const category = grouped.get(categoryId);
      const index = categoryIndexes.get(categoryId) ?? 0;
      const candidate = category[index];
      if (!candidate) continue;
      generated.push(toCatalogFood(candidate));
      categoryIndexes.set(categoryId, index + 1);
      addedThisRound = true;
      if (generated.length >= generatedTarget) break;
    }
    if (!addedThisRound) break;
  }

  const foods = [...curatedFoods, ...generated];
  const catalog = {
    version: 2,
    updatedAt: new Date().toISOString().slice(0, 10),
    source: "USDA FoodData Central SR Legacy; nutrient values per 100 g",
    sourceUrl: "https://fdc.nal.usda.gov/download-datasets/",
    sourceRelease: "SR Legacy 2018-04",
    generatedBy: "scripts/build-nutrition-catalog.mjs",
    foods,
  };
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Wrote ${foods.length} foods (${curatedFoods.length} curated, ${generated.length} generated) to ${outputPath}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
