// 절차적 BGM — 에셋 없이 Web Audio로 테마별 루프 생성.
// 지옥(6스테이지) 입성 시 바흐 토카타와 푸가 d단조 BWV 565 오프닝을
// 오르간 톤으로 연주한 뒤 드라이빙 비트로 떨어지는 연출.

let actx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem('ait-muted') === '1';
} catch {
  /* 무시 */
}

const VOL = 0.42; // 마스터 볼륨
let running = false;
let curStage = 1;
let loopPos = 0;
let nextStepTime = 0;
let introUntil = 0; // 이 시각까지는 루프 음소거(지옥 인트로 동안)
let timer: ReturnType<typeof setTimeout> | null = null;
let sources: OscillatorNode[] = [];

function getCtx(): AudioContext | null {
  try {
    if (!actx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0;
      master.connect(actx.destination);
    }
    if (actx.state === 'suspended') void actx.resume();
    return actx;
  } catch {
    return null;
  }
}

export function unlock(): void {
  getCtx();
}
export function isMuted(): boolean {
  return muted;
}
export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('ait-muted', m ? '1' : '0');
  } catch {
    /* 무시 */
  }
  if (actx && master) {
    const target = m ? 0 : running ? VOL : 0;
    master.gain.setTargetAtTime(target, actx.currentTime, 0.02);
  }
}

// 음표 이름 → 주파수 (예: "A5", "C#5", "Bb1")
const SEMI: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6,
  Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};
function nf(name: string): number {
  const m = /^([A-G][#b]?)(\d)$/.exec(name);
  if (!m) return 0;
  const semi = SEMI[m[1]];
  const midi = (parseInt(m[2], 10) + 1) * 12 + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function parse(s: string): number[] {
  return s.trim().split(/\s+/).map((t) => (t === '.' ? 0 : nf(t)));
}

interface StageMusic {
  bpm: number;
  wave: OscillatorType;
  mel: number[];
  bass: number[];
  drums: boolean;
}

const TRACKS: StageMusic[] = [
  // 1 아침
  {
    bpm: 100, wave: 'triangle', drums: false,
    mel: parse('C5 . E5 . G5 . E5 . A4 . C5 . E5 . D5 .'),
    bass: parse('C3 . . . G2 . . . A2 . . . F2 . . .'),
  },
  // 2 노을
  {
    bpm: 92, wave: 'triangle', drums: false,
    mel: parse('F4 A4 C5 A4 F4 G4 A4 C5 D5 C5 A4 G4 F4 A4 G4 .'),
    bass: parse('F2 . . . C3 . . . D3 . . . C3 . . .'),
  },
  // 3 밤하늘
  {
    bpm: 88, wave: 'sine', drums: false,
    mel: parse('A4 . C5 . E5 . D5 . C5 . B4 . A4 . E4 .'),
    bass: parse('A2 . . . F2 . . . G2 . . . E2 . . .'),
  },
  // 4 우주
  {
    bpm: 80, wave: 'sine', drums: false,
    mel: parse('E5 . . B4 . . D5 . . A4 . . E4 . . .'),
    bass: parse('E2 . . . . . . . C2 . . . . . . .'),
  },
  // 5 오로라
  {
    bpm: 96, wave: 'triangle', drums: false,
    mel: parse('D5 E5 F5 A5 G5 F5 E5 D5 C5 D5 E5 F5 E5 D5 . .'),
    bass: parse('D3 . . . A2 . . . Bb2 . . . A2 . . .'),
  },
  // 6 지옥 — 드라이빙
  {
    bpm: 140, wave: 'sawtooth', drums: true,
    mel: parse('D5 . D5 D5 . D5 . A4 . Bb4 . A4 . G4 . F4'),
    bass: parse('D2 D2 D2 D2 D2 D2 D2 D2 Bb1 Bb1 Bb1 Bb1 A1 A1 A1 A1'),
  },
];

function track(): StageMusic {
  return TRACKS[Math.min(curStage, TRACKS.length) - 1];
}

function voice(
  freq: number,
  t0: number,
  dur: number,
  type: OscillatorType,
  vol: number,
): void {
  if (!actx || !master || freq <= 0) return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
  sources.push(o);
}

function kick(t0: number): void {
  if (!actx || !master) return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t0);
  o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
  g.gain.setValueAtTime(0.55, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + 0.19);
  sources.push(o);
}

function playStep(pos: number, t: number): void {
  if (t < introUntil) return; // 인트로 동안 루프 정지
  const tr = track();
  voice(tr.mel[pos], t, (30 / tr.bpm) * 1.6, tr.wave, tr.drums ? 0.12 : 0.16);
  voice(tr.bass[pos], t, (30 / tr.bpm) * 1.5, tr.drums ? 'sawtooth' : 'triangle', 0.17);
  if (tr.drums && pos % 2 === 0) kick(t);
}

function scheduler(): void {
  if (!running || !actx) return;
  const secPerStep = 30 / track().bpm; // 8분음표
  while (nextStepTime < actx.currentTime + 0.12) {
    playStep(loopPos, nextStepTime);
    nextStepTime += secPerStep;
    loopPos = (loopPos + 1) % 16;
  }
  timer = setTimeout(scheduler, 25);
}

// 지옥 인트로: 토카타 BWV 565 오프닝 → 마지막 저음 코드에서 비트 드랍
function playHellIntro(): void {
  if (!actx) return;
  const t0 = actx.currentTime + 0.06;
  const seq: Array<[string, number, number, number]> = [
    // [음, 시작(초), 길이, 볼륨]  — 디~로리
    ['A5', 0.0, 0.16, 0.24], ['G5', 0.16, 0.09, 0.22], ['A5', 0.25, 0.55, 0.24],
    // 하강 런
    ['G5', 0.98, 0.12, 0.2], ['F5', 1.1, 0.12, 0.2], ['E5', 1.22, 0.12, 0.2],
    ['D5', 1.34, 0.12, 0.2], ['C#5', 1.46, 0.12, 0.2], ['D5', 1.58, 0.42, 0.22],
    // 큰 코드
    ['D4', 2.1, 1.0, 0.16], ['F4', 2.1, 1.0, 0.16], ['A4', 2.1, 1.0, 0.16],
    // 낮은 메아리
    ['A4', 3.25, 0.16, 0.22], ['G4', 3.41, 0.09, 0.2], ['A4', 3.5, 0.5, 0.22],
    ['F4', 4.05, 0.12, 0.2], ['E4', 4.17, 0.12, 0.2], ['D4', 4.29, 0.12, 0.2],
    ['C#4', 4.41, 0.12, 0.2], ['D4', 4.53, 0.5, 0.22],
    // 최종 저음 코드(여기서 비트 드랍)
    ['D3', 5.0, 1.4, 0.18], ['F3', 5.0, 1.4, 0.18], ['A3', 5.0, 1.4, 0.18],
  ];
  for (const [name, at, dur, vol] of seq) {
    voice(nf(name), t0 + at, dur, 'sawtooth', vol);
  }
  introUntil = t0 + 5.0; // 저음 코드 시점에 루프(비트) 드랍
}

export function start(stageNo: number): void {
  if (!getCtx() || !actx || !master) return;
  curStage = stageNo;
  loopPos = 0;
  introUntil = 0;
  running = true;
  master.gain.setTargetAtTime(muted ? 0 : VOL, actx.currentTime, 0.03);
  nextStepTime = actx.currentTime + 0.1;
  if (timer) clearTimeout(timer);
  scheduler();
}

export function setStage(stageNo: number): void {
  if (curStage === stageNo) return;
  curStage = stageNo;
  loopPos = 0;
  if (stageNo === 6) playHellIntro();
  else introUntil = 0;
}

export function stop(): void {
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (actx && master) master.gain.setTargetAtTime(0, actx.currentTime, 0.04);
  // 예약된 음 즉시 정지(특히 지옥 인트로)
  const now = actx ? actx.currentTime : 0;
  for (const o of sources) {
    try {
      o.stop(now);
    } catch {
      /* 무시 */
    }
  }
  sources = [];
}
