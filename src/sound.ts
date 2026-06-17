// Web Audio 기반 효과음 (에셋 파일 없이 코드로 생성 — 번들 용량 0)
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.2,
  freqEnd?: number,
  delay = 0,
): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
  }
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sounds = {
  // 점프: 짧고 가벼운 상승음
  flap(): void {
    tone(420, 0.1, 'triangle', 0.15, 700);
  },
  // 점수: 맑은 딩
  score(): void {
    tone(880, 0.09, 'sine', 0.18);
    tone(1318, 0.12, 'sine', 0.15, undefined, 0.07);
  },
  // 충돌: 둔탁한 하강음
  hit(): void {
    tone(220, 0.25, 'sawtooth', 0.22, 60);
  },
  // 신기록: 짧은 팡파레
  best(): void {
    tone(659, 0.1, 'triangle', 0.16, undefined, 0);
    tone(784, 0.1, 'triangle', 0.16, undefined, 0.09);
    tone(1047, 0.22, 'triangle', 0.18, undefined, 0.18);
  },
  // 포탈 통과: 짧은 워프음 (상승 후 하강)
  portal(): void {
    tone(523, 0.08, 'square', 0.1, 1046);
    tone(784, 0.16, 'triangle', 0.12, 392, 0.06);
  },
  // 스테이지 업: 밝게 상승하는 아르페지오
  stage(): void {
    tone(523, 0.12, 'triangle', 0.16, undefined, 0);
    tone(659, 0.12, 'triangle', 0.16, undefined, 0.08);
    tone(784, 0.12, 'triangle', 0.16, undefined, 0.16);
    tone(1047, 0.26, 'triangle', 0.18, undefined, 0.24);
  },
  unlock(): void {
    // 첫 사용자 입력 시 AudioContext 활성화용
    getCtx();
  },
};
