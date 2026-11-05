/** src/data/*.json 읽기 (view · 테스트 공용 입구). 수치는 전부 여기로만 들어온다 */
import buildings from '../data/buildings.json';
import stages from '../data/stages.json';
import game_config from '../data/game_config.json';
import ui_strings from '../data/ui_strings.json';
import upgrades from '../data/upgrades.json';
import type { GameConfig } from '../core/config';
import { validateConfig } from '../core/config';
import { fromData, type RawGameData } from '../core/data';

export const RAW_DATA: RawGameData = { buildings, stages, game_config, ui_strings, upgrades } as unknown as RawGameData;
export const UI_STRINGS = ui_strings;

export function loadGameConfig(raw: RawGameData = RAW_DATA): { config: GameConfig; errors: string[] } {
  const config = fromData(raw);
  return { config, errors: validateConfig(config) };
}
