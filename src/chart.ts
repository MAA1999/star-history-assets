import { mkdir } from "node:fs/promises";
import path from "node:path";

import { JSDOM } from "jsdom";
import sharp from "sharp";
import { optimize } from "svgo";

import { buildChartData } from "./data";
import XYChart from "./vendor/star-history/xy-chart";

export type ChartTheme = "light" | "dark";

function fixJsdomSvgCasing(svg: string): string {
  return svg
    .replace(/feturbulence/g, "feTurbulence")
    .replace(/fedisplacementmap/g, "feDisplacementMap")
    .replace(/filterunits/g, "filterUnits")
    .replace(/basefrequency/g, "baseFrequency")
    .replace(/xchannelselector/g, "xChannelSelector")
    .replace(/ychannelselector/g, "yChannelSelector");
}

export async function renderChart(
  repository: string,
  timestamps: string[],
  theme: ChartTheme,
  outputPath: string,
  width = 1400,
): Promise<void> {
  const dom = new JSDOM("<!DOCTYPE html><body></body>");
  const body = dom.window.document.querySelector("body");
  const svg = dom.window.document.createElement("svg") as unknown as SVGSVGElement;
  if (!body) throw new Error("Failed to create JSDOM body");

  body.append(svg as unknown as Node);
  svg.setAttribute("width", String(width));
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  XYChart(
    svg,
    {
      title: "Star History",
      xLabel: "Date",
      yLabel: "GitHub Stars",
      data: buildChartData(repository, timestamps),
      showDots: false,
      transparent: false,
      theme,
    },
    {
      envType: "node",
      xTickLabelType: "Date",
      chartWidth: width,
      legendPosition: "top-left",
    },
  );

  const svgContent = fixJsdomSvgCasing(svg.outerHTML);
  const optimized = optimize(svgContent, { multipass: true }).data;
  const background = theme === "dark" ? "#0d1117" : "#ffffff";

  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(optimized))
    .flatten({ background })
    .webp({ effort: 6, quality: 92, smartSubsample: true })
    .toFile(outputPath);
}
