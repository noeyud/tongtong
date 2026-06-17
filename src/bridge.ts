// 앱인토스 네이티브 기능 래퍼.
// 토스 앱(샌드박스) 안에서는 네이티브 햅틱/저장소를 쓰고,
// 일반 브라우저에서는 조용히 폴백해요.
import { generateHapticFeedback, Storage } from '@apps-in-toss/web-framework';

export type HapticType =
  | 'tickWeak'
  | 'tap'
  | 'tickMedium'
  | 'softMedium'
  | 'basicWeak'
  | 'basicMedium'
  | 'success'
  | 'error'
  | 'wiggle'
  | 'confetti';

export function haptic(type: HapticType): void {
  try {
    void generateHapticFeedback({ type });
  } catch {
    // 브라우저 등 미지원 환경에서는 무시
  }
}

const bestKey = (mode: string): string => `flappy-best-${mode}`;

// 모드별 최고 점수 불러오기 (통통새/통통배 분리)
export async function loadBest(mode: string): Promise<number> {
  try {
    const value = await Storage.getItem(bestKey(mode));
    if (value != null) return Number(value) || 0;
  } catch {
    // 폴백
  }
  try {
    return Number(localStorage.getItem(bestKey(mode))) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(mode: string, score: number): void {
  try {
    void Storage.setItem(bestKey(mode), String(score));
  } catch {
    // 폴백
  }
  try {
    localStorage.setItem(bestKey(mode), String(score));
  } catch {
    // 무시
  }
}
