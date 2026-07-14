import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { renderChart } from "../src/chart";
import { buildChartData } from "../src/data";
import { fetchStargazerTimestamps, parseNextLink } from "../src/github";

test("parseNextLink returns the next GitHub page", () => {
  const header =
    '<https://api.github.com/repositories/1/stargazers?per_page=100&page=2>; rel="next", ' +
    '<https://api.github.com/repositories/1/stargazers?per_page=100&page=4>; rel="last"';
  assert.equal(parseNextLink(header), "https://api.github.com/repositories/1/stargazers?per_page=100&page=2");
});

test("fetchStargazerTimestamps follows pages and deduplicates users", async () => {
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (calls.length === 1) {
      return new Response(
        JSON.stringify([
          { starred_at: "2025-01-01T00:00:00Z", user: { login: "alice" } },
          { starred_at: "2025-01-01T00:00:00Z", user: { login: "bob" } },
        ]),
        {
          headers: {
            link: '<https://api.github.com/repos/owner/repo/stargazers?per_page=100&page=2>; rel="next"',
          },
        },
      );
    }
    return new Response(
      JSON.stringify([
        { starred_at: "2025-01-01T00:00:00Z", user: { login: "alice" } },
        { starred_at: "2025-01-02T00:00:00Z", user: { login: "carol" } },
      ]),
    );
  }) as typeof fetch;

  assert.deepEqual(await fetchStargazerTimestamps("owner/repo", "token", fetcher), [
    "2025-01-01T00:00:00Z",
    "2025-01-01T00:00:00Z",
    "2025-01-02T00:00:00Z",
  ]);
  assert.equal(calls.length, 2);
});

test("buildChartData aggregates stars by UTC day", () => {
  const chart = buildChartData(
    "owner/repo",
    ["2025-01-02T10:00:00Z", "2025-01-02T10:00:00Z", "2025-01-04T10:00:00Z"],
    new Date("2025-01-05T00:00:00Z"),
  );
  assert.deepEqual(
    chart.datasets[0].data.map((point) => [
      point.x instanceof Date ? point.x.toISOString().slice(0, 10) : point.x,
      point.y,
    ]),
    [
      ["2025-01-01", 0],
      ["2025-01-02", 2],
      ["2025-01-04", 3],
      ["2025-01-05", 3],
    ],
  );
});

test("renderChart writes a WebP image", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "star-history-assets-"));
  const output = path.join(directory, "light.webp");
  try {
    await renderChart(
      "owner/repo",
      ["2025-01-02T10:00:00Z", "2025-02-01T10:00:00Z", "2025-03-01T10:00:00Z"],
      "light",
      output,
      800,
    );
    const metadata = await sharp(await readFile(output)).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 800);
    assert.ok((metadata.height ?? 0) > 0);
  } finally {
    await rm(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 100 });
  }
});
