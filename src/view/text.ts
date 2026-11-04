/** ui_strings 읽기 + 자리 채우기 ({n} = 숫자, {label} = 이름) — 문구 원본은 design/tables/ui_strings.xlsx */
import { UI_STRINGS } from './gameData';

type Tree = { [k: string]: string | Tree };

export function t(key: string, vars: Record<string, string | number> = {}): string {
  const v = key.split('.').reduce<string | Tree | undefined>((node, k) => (node && typeof node === 'object' ? node[k] : undefined), UI_STRINGS as Tree);
  const s = typeof v === 'string' ? v : key; // 없으면 키를 그대로 보여 줘서 바로 눈에 띄게 (검증이 먼저 막음)
  return s.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}
