/**
 * art/game/**.png → 파일 이름별 URL (빌드에 묶임). 게임은 art/game/만 읽는다 (docs/art.md — art/production은 원본 보관).
 * 파일이 없으면 목록에 없을 뿐이라 404 · 콘솔 오류가 나지 않는다 → 도형 폴백
 */
const urls = import.meta.glob('/art/game/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const ART_FILE_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
);

export const artTextureKey = (file: string): string => `art:${file}`;
