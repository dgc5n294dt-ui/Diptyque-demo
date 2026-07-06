import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { retrieveGraphQuestion } from "./retrieve-graph.js";

type TestCase = {
  id: number;
  question: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const testFilePath = resolve(rootDir, "work/retrieval-test-questions.json");
const resultFilePath = resolve(rootDir, "work/retrieval-test-results.json");

async function main(): Promise<void> {
  const raw = await readFile(testFilePath, "utf-8");
  const testCases = JSON.parse(raw) as TestCase[];
  const outputs: Array<Record<string, unknown>> = [];

  for (const testCase of testCases) {
    const result = await retrieveGraphQuestion(testCase.question);
    outputs.push({
      id: testCase.id,
      ...result,
    });
  }

  const rendered = `${JSON.stringify(outputs, null, 2)}\n`;
  await writeFile(resultFilePath, rendered, "utf-8");
  console.log(rendered);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});