import type { XYChartData } from "./vendor/star-history/xy-chart";

export interface RepositoryConfig {
  repository: string;
  slug: string;
}

export interface StarCache {
  repository: string;
  stars: string[];
}

function toUtcDay(value: string | Date): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid star timestamp: ${String(value)}`);
  return parsed.toISOString().slice(0, 10);
}

function previousUtcDay(value: string): Date {
  const result = new Date(`${value}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

export function buildChartData(repository: string, timestamps: string[], now = new Date()): XYChartData {
  const starsByDay = new Map<string, number>();
  for (const timestamp of timestamps) {
    const day = toUtcDay(timestamp);
    starsByDay.set(day, (starsByDay.get(day) ?? 0) + 1);
  }

  const days = [...starsByDay.keys()].sort();
  const today = toUtcDay(now);
  const data: { x: Date; y: number }[] = [];

  if (days.length === 0) {
    data.push({ x: previousUtcDay(today), y: 0 }, { x: new Date(`${today}T00:00:00Z`), y: 0 });
  } else {
    data.push({ x: previousUtcDay(days[0]), y: 0 });
    let total = 0;
    for (const day of days) {
      total += starsByDay.get(day) ?? 0;
      data.push({ x: new Date(`${day}T00:00:00Z`), y: total });
    }
    if (days.at(-1)! < today) data.push({ x: new Date(`${today}T00:00:00Z`), y: total });
  }

  return {
    datasets: [
      {
        label: repository,
        logo: "",
        data,
      },
    ],
  };
}
