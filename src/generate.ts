import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderChart, type ChartTheme } from "./chart";
import type { RepositoryConfig, StarCache } from "./data";
import { fetchStargazerTimestamps } from "./github";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG_PATTERN = /^[A-Za-z0-9._-]+$/;
const THEMES: ChartTheme[] = ["light", "dark"];

async function loadRepositories(): Promise<RepositoryConfig[]> {
  const configPath = path.join(ROOT, "config", "repos.json");
  const raw: unknown = JSON.parse(await readFile(configPath, "utf8"));
  if (!raw || typeof raw !== "object" || !("repositories" in raw) || !Array.isArray(raw.repositories)) {
    throw new Error("config must contain a repositories array");
  }

  return raw.repositories.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`repositories[${index}] must be an object`);
    const { repository, slug } = item as Record<string, unknown>;
    if (typeof repository !== "string" || repository.split("/").length !== 2) {
      throw new Error(`repositories[${index}].repository must use owner/name format`);
    }
    if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
      throw new Error(`repositories[${index}].slug contains unsupported characters`);
    }
    return { repository, slug };
  });
}

async function loadCache(config: RepositoryConfig): Promise<string[]> {
  const cachePath = path.join(ROOT, "data", `${config.slug}.json`);
  const raw: unknown = JSON.parse(await readFile(cachePath, "utf8"));
  if (!raw || typeof raw !== "object") throw new Error(`Invalid cache for ${config.repository}`);
  const cache = raw as Partial<StarCache>;
  if (cache.repository !== config.repository || !Array.isArray(cache.stars)) {
    throw new Error(`Invalid cache for ${config.repository}`);
  }
  return cache.stars.filter((value): value is string => typeof value === "string");
}

async function writeCache(config: RepositoryConfig, timestamps: string[]): Promise<void> {
  const cachePath = path.join(ROOT, "data", `${config.slug}.json`);
  const content: StarCache = { repository: config.repository, stars: timestamps };
  await writeFile(cachePath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const fromCache = process.argv.includes("--from-cache");
  const token = process.env.GH_TOKEN?.trim() ?? "";
  if (!fromCache && !token) throw new Error("GH_TOKEN is required unless --from-cache is used");

  for (const config of await loadRepositories()) {
    const timestamps = fromCache ? await loadCache(config) : await fetchStargazerTimestamps(config.repository, token);
    if (!fromCache) await writeCache(config, timestamps);

    for (const theme of THEMES) {
      const outputPath = path.join(ROOT, "generated", config.slug, `${theme}.webp`);
      await renderChart(config.repository, timestamps, theme, outputPath);
      console.log(`generated ${path.relative(ROOT, outputPath)}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
