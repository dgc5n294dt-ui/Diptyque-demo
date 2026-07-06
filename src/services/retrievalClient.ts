import type { GraphData } from "../lib/contracts.js";

export function publicUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(publicUrl(path));
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function loadProductGraph(): Promise<GraphData> {
  return fetchJson<GraphData>("product-graph.json");
}