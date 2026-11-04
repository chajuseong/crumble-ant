import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** CLAUDE.md 반드시 지킬 규칙 2: src/core/에는 Phaser · DOM · window 참조 금지 (Unity 이식 대상) */
const FORBIDDEN = [/from\s+["']phaser["']/, /\bwindow\./, /\bdocument\./, /\bMath\.random\(/, /\bDate\.now\(/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("src/core 규칙", () => {
  it("Phaser · DOM · window · Math.random · Date.now 를 쓰지 않는다", () => {
    const hits = files("src/core").flatMap((f) => {
      const src = readFileSync(f, "utf-8");
      return FORBIDDEN.filter((re) => re.test(src)).map((re) => `${f}: ${re}`);
    });
    expect(hits).toEqual([]);
  });
});
