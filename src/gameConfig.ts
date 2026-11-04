/** config/*.json 묶음. 수치는 전부 여기서만 들어온다 (코드에 박지 않음). */
import layout from '../config/layout.json';
import battle from '../config/battle.json';
import buildings from '../config/buildings.json';
import stages from '../config/stages.json';
import input from '../config/input.json';
import strip from '../config/strip.json';
import { type GameConfig, validateConfig } from './core/config';

export const RAW_CONFIG = { layout, battle, buildings, stages, input, strip };

export function loadGameConfig(): { config: GameConfig; errors: string[] } {
  const errors = validateConfig(RAW_CONFIG);
  return { config: RAW_CONFIG as unknown as GameConfig, errors };
}
