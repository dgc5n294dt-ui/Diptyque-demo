import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

function parseLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const idx = trimmed.indexOf("=");
  if (idx <= 0) return null;

  const key = trimmed.slice(0, idx).trim();
  let value = trimmed.slice(idx + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function ensureLocalEnvLoaded(): void {
  if (loaded) return;
  loaded = true;

  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
