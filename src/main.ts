import { haptic, loadBest, saveBest } from './bridge';
import * as lb from './leaderboard';
import { sounds } from './sound';
import * as music from './music';

// ---------- 캔버스 설정 ----------
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W = 0; // 논리 너비
let H = 0; // 논리 높이

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------- 색상 (토스 스타일) ----------
const COLOR = {
  skyTop: '#E8F3FF',
  skyBottom: '#FFFFFF',
  bird: '#3182F6',
  birdWing: '#FFFFFF',
  birdBeak: '#FFB331',
  pipe: '#4E5968',
  pipeCap: '#6B7684',
  ground: '#F2F4F6',
  groundLine: '#E5E8EB',
  text: '#191F28',
  subText: '#8B95A1',
  card: '#FFFFFF',
  button: '#3182F6',
  buttonText: '#FFFFFF',
  cloud: 'rgba(255, 255, 255, 0.9)',
  newBest: '#F04452',
};

// 스테이지별 배경 테마
interface StageTheme {
  name: string;
  skyTop: string;
  skyBottom: string;
  ground: string;
  groundLine: string;
  cloud: string;
  fg: string; // 하늘 위 HUD 글자색
  stars: boolean;
}
const STAGE_THEMES: StageTheme[] = [
  { name: '아침 하늘', skyTop: '#E8F3FF', skyBottom: '#FFFFFF', ground: '#F2F4F6', groundLine: '#E5E8EB', cloud: 'rgba(255,255,255,0.9)', fg: '#191F28', stars: false },
  { name: '노을', skyTop: '#FFD9A8', skyBottom: '#FFF1E6', ground: '#F6E9DC', groundLine: '#EAD3BC', cloud: 'rgba(255,255,255,0.85)', fg: '#5A3B25', stars: false },
  { name: '밤하늘', skyTop: '#243056', skyBottom: '#4A6491', ground: '#2A3550', groundLine: '#3B496B', cloud: 'rgba(255,255,255,0.45)', fg: '#FFFFFF', stars: true },
  { name: '우주', skyTop: '#160F2B', skyBottom: '#392A66', ground: '#1E1736', groundLine: '#322A55', cloud: 'rgba(255,255,255,0.32)', fg: '#FFFFFF', stars: true },
  { name: '오로라', skyTop: '#0C3B39', skyBottom: '#1E7A6A', ground: '#103634', groundLine: '#1F524C', cloud: 'rgba(200,255,240,0.5)', fg: '#EAFFF8', stars: true },
  { name: '지옥', skyTop: '#3A0A0A', skyBottom: '#8A1C12', ground: '#280707', groundLine: '#4A140F', cloud: 'rgba(255,170,110,0.22)', fg: '#FFFFFF', stars: true },
];

interface Star {
  x: number;
  y: number;
  r: number;
  p: number; // 반짝임 위상
}

// ---------- 게임 상수 ----------
const GRAVITY = 1900; // px/s^2
const FLAP_VELOCITY = -560; // px/s
const BIRD_X_RATIO = 0.28;
const BIRD_RADIUS = 17;
const PIPE_WIDTH = 64;
const GROUND_HEIGHT = 96;

// 난이도 점진 상승
const BASE_SPEED = 170; // px/s
const SPEED_PER_SCORE = 3.2;
const MAX_SPEED = 320;
const BASE_GAP = 185;
const GAP_PER_SCORE = 1.4;
const MIN_GAP = 128;
const PIPE_SPACING = 250; // 기본 파이프 가로 간격(px)
const SPACING_COMP = 0.8; // 전체 속도 증가분의 80%만큼 기둥 간격도 벌림(여유 보정)

// 물리 완화
const TERMINAL_VEL = 620; // 최대 낙하/상승 속도 — '팍 떨어짐' 방지
const SHIP_ACCEL = 2400; // 통통배(ship): 누르면 상승 / 떼면 하강 가속도

// 포탈 기믹 상수
const PORTAL_WIDTH = 50;
const MINI_SCALE = 0.56; // 미니 모드 새 크기 배율
const SPEED_SLOW = 0.58; // 감속(-1단계) 배율
const SPEED_UP_STEPS = [1.32, 1.66, 2.05]; // 가속 1·2·3단계 배율
const SPEED_MAX_LV = 3; // 최대 가속 단계
const SPEED_MIN_LV = -1; // 최저 감속 단계
const PORTAL_MIN_DIST = 460; // 포탈 최소 간격(px)
const PORTAL_RAND_DIST = 340; // 포탈 간격 랜덤 범위(px)

// 목숨 & 타격감
const MAX_LIVES = 3; // 최대 목숨
const INVINC_TIME = 1.4; // 피격 후 무적 시간(초)
const PORTAL_WARN_TIME = 1.0; // 포탈 등장 예고 시간(초)

// 스테이지 & 생명 물약
const HEART_MAX = 5; // 물약으로 늘릴 수 있는 최대 목숨
const STAGE_PIPES = 15; // 스테이지당 통과 기둥 수
const MAX_STAGE = 6; // 최대 스테이지
const STAGE_BANNER_TIME = 1.6; // 스테이지 배너 표시 시간(초)

// 콤보 (피격 없이 연속 통과 → 점수 배수)
const COMBO_STEP = 5; // 이 개수마다 배수 +1
const MAX_MULT = 5; // 최대 배수

type GameState = 'ready' | 'playing' | 'gameover';
type CraftMode = 'bird' | 'boat'; // 통통새(UFO) / 통통배(ship)

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type PortalKind =
  | 'grav-on'
  | 'grav-off'
  | 'mirror'
  | 'mini-on'
  | 'mini-off'
  | 'speed-up'
  | 'speed-2'
  | 'speed-3'
  | 'speed-normal'
  | 'speed-down';

interface PortalStyle {
  c: string;
  glyph: string;
  label: string;
}

// 포탈별 색/아이콘/라벨
const PORTAL_STYLE: Record<PortalKind, PortalStyle> = {
  'grav-on': { c: '#8B5CF6', glyph: '⇅', label: '중력반전' },
  'grav-off': { c: '#8B5CF6', glyph: '↓', label: '중력복구' },
  mirror: { c: '#F04452', glyph: '⇄', label: '좌우반전' },
  'mini-on': { c: '#00C2A8', glyph: '▽', label: '미니' },
  'mini-off': { c: '#00C2A8', glyph: '△', label: '원래크기' },
  'speed-up': { c: '#FF8A00', glyph: '»', label: '가속' },
  'speed-2': { c: '#FB6514', glyph: '»', label: '2단가속' },
  'speed-3': { c: '#F04452', glyph: '»', label: '3단가속' },
  'speed-normal': { c: '#8B95A1', glyph: '=', label: '정상속도' },
  'speed-down': { c: '#1B64DA', glyph: '«', label: '감속' },
};

interface Pipe {
  x: number;
  gapY: number; // 틈 중앙 y
  gap: number;
  passed: boolean;
}

interface Portal {
  x: number; // 왼쪽 가장자리
  kind: PortalKind;
  applied: boolean;
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 남은 수명(초)
  max: number; // 최초 수명
  color: string;
  size: number;
}

interface PendingPortal {
  kind: PortalKind;
  timer: number; // 남은 예고 시간(초)
}

// 현재 활성 기믹 상태 (포탈로 토글 / 해제)
interface Modifiers {
  gravFlip: boolean; // 중력 반전
  dir: 1 | -1; // 1=정상, -1=좌우(진행방향) 반전
  mini: boolean; // 미니
  speedLv: number; // -1 감속, 0 보통, 1~3 가속
}

// ---------- 게임 상태 ----------
let state: GameState = 'ready';
let birdY = 0;
let birdVel = 0;
let pipes: Pipe[] = [];
let portals: Portal[] = [];
let clouds: Cloud[] = [];
let score = 0;
let pipesPassed = 0; // 진행/난이도/스테이지 기준 (콤보 배수와 무관)
let combo = 0; // 피격 없이 연속 통과한 기둥 수
let comboPop = 0; // 콤보 표시 강조(0~1)
const best = { bird: 0, boat: 0 }; // 모드별 최고 점수
let isNewBest = false;
let gameOverAt = 0;
let lastTime = 0;
let wingPhase = 0;

let lives = MAX_LIVES; // 남은 목숨
let invinc = 0; // 무적 잔여 시간(초)
let shake = 0; // 화면 흔들림 세기
let flash = 0; // 피격 플래시(0~1)
let scorePop = 0; // 점수 팝 애니메이션(0~1)
let particles: Particle[] = [];
let pendingPortal: PendingPortal | null = null; // 예고 중인 포탈
let gravQueued: PortalKind | null = null; // 중력반전: 다음 기둥 자리에 단독 생성 대기
let stage = 1; // 현재 스테이지(1~5)
let stageBanner = 0; // 스테이지 배너 잔여 시간
let stageFlash = 0; // 스테이지 전환 플래시(0~1)
let healPulse = 0; // 생명 회복 하트 강조(0~1)
let stars: Star[] = [];

let mode: CraftMode = 'bird'; // 선택된 조종 모드
let pointerHeld = false; // 통통배: 누르고 있는 중인지
let boardOpen = false; // 리더보드 열림 여부
let boardMode: CraftMode = 'bird'; // 리더보드에서 보는 모드
let boardRows: lb.BoardRow[] | null = null; // null=로딩 중

let mods: Modifiers = { gravFlip: false, dir: 1, mini: false, speedLv: 0 };
let pipeAccum = 0; // 파이프 스폰용 거리 누적
let portalAccum = 0; // 포탈 스폰용 거리 누적
let nextPortalDist = PORTAL_MIN_DIST; // 다음 포탈까지 거리

void loadBest('bird').then((v) => {
  best.bird = v;
});
void loadBest('boat').then((v) => {
  best.boat = v;
});

function playH(): number {
  return H - GROUND_HEIGHT;
}

function currentSpeed(): number {
  return Math.min(MAX_SPEED, BASE_SPEED + pipesPassed * SPEED_PER_SCORE);
}

function currentGap(): number {
  return Math.max(MIN_GAP, BASE_GAP - pipesPassed * GAP_PER_SCORE);
}

// 현재 콤보 점수 배수
function comboMult(): number {
  return Math.min(MAX_MULT, 1 + Math.floor(combo / COMBO_STEP));
}

// ---------- 기믹 헬퍼 ----------
function gravity(): number {
  // 중력 세기는 정상과 동일, 방향만 반전
  return GRAVITY * (mods.gravFlip ? -1 : 1);
}
function flapVel(): number {
  // 점프 세기는 정상과 동일, 방향만 반전
  return FLAP_VELOCITY * (mods.gravFlip ? -1 : 1);
}
function birdRadius(): number {
  return BIRD_RADIUS * (mods.mini ? MINI_SCALE : 1);
}
function speedMult(): number {
  if (mods.speedLv < 0) return SPEED_SLOW;
  if (mods.speedLv === 0) return 1;
  return SPEED_UP_STEPS[mods.speedLv - 1];
}
// 현재 속도에 맞춘 기둥 간격 — 전체 속도(기본 가속+포탈)에 비례해 여유롭게 벌림
function pipeSpacing(): number {
  const ratio = (currentSpeed() * speedMult()) / BASE_SPEED; // 1.0 = 기본 속도
  return PIPE_SPACING * (1 + Math.max(0, ratio - 1) * SPACING_COMP);
}
// 진행 방향에 따른 새의 화면 X (정상=왼쪽, 반전=오른쪽)
function birdScreenX(): number {
  return mods.dir > 0 ? W * BIRD_X_RATIO : W * (1 - BIRD_X_RATIO);
}
// 파이프/포탈이 진입하는 선두 가장자리
function spawnEdgeX(objW: number): number {
  return mods.dir > 0 ? W + 24 : -objW - 24;
}

function initClouds(): void {
  clouds = [];
  for (let i = 0; i < 5; i++) {
    clouds.push({
      x: Math.random() * W,
      y: 40 + Math.random() * (playH() * 0.4),
      scale: 0.6 + Math.random() * 0.8,
      speed: 8 + Math.random() * 14,
    });
  }
}
initClouds();

function initStars(): void {
  stars = [];
  for (let i = 0; i < 46; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * playH() * 0.85,
      r: 0.6 + Math.random() * 1.6,
      p: Math.random() * Math.PI * 2,
    });
  }
}
initStars();

// 현재 스테이지 테마
function theme(): StageTheme {
  return STAGE_THEMES[Math.min(stage, MAX_STAGE) - 1];
}

// 스테이지별 해금된 기믹 (누적). 6스테이지는 전부 + 더 잦은 랜덤 조합
function stageGimmicks(st: number): {
  mini: boolean;
  speed: boolean;
  mirror: boolean;
  grav: boolean;
} {
  return {
    mini: st >= 2,
    mirror: st >= 3,
    grav: st >= 4,
    speed: st >= 5,
  };
}

// 새 기믹/스테이지 안내 문구
function stageIntro(st: number): string | null {
  switch (st) {
    case 2:
      return '미니 등장!';
    case 3:
      return '좌우반전 등장!';
    case 4:
      return '중력반전 등장!';
    case 5:
      return '가속 등장!';
    case 6:
      return '지옥 · 랜덤 조합!';
    default:
      return null;
  }
}

function reset(): void {
  state = 'ready';
  music.stop();
  birdY = playH() * 0.45;
  birdVel = 0;
  pipes = [];
  portals = [];
  score = 0;
  pipesPassed = 0;
  combo = 0;
  comboPop = 0;
  isNewBest = false;
  mods = { gravFlip: false, dir: 1, mini: false, speedLv: 0 };
  pipeAccum = 0;
  portalAccum = 0;
  nextPortalDist = PORTAL_MIN_DIST + Math.random() * PORTAL_RAND_DIST;
  lives = MAX_LIVES;
  invinc = 0;
  shake = 0;
  flash = 0;
  scorePop = 0;
  particles = [];
  pendingPortal = null;
  gravQueued = null;
  pointerHeld = false;
  stage = 1;
  stageBanner = 0;
  stageFlash = 0;
  healPulse = 0;
}
reset();

function spawnPipe(): void {
  const gap = currentGap();
  const margin = 70;
  const minY = margin + gap / 2;
  const maxY = playH() - margin - gap / 2;
  pipes.push({
    x: spawnEdgeX(PIPE_WIDTH),
    gapY: minY + Math.random() * Math.max(1, maxY - minY),
    gap,
    passed: false,
  });
}

// 활성 기믹이 많을수록(위험할수록) 점수 보너스 배수
function hazardMult(): number {
  let h = 1;
  if (mods.gravFlip) h += 0.5; // 중력반전
  if (mods.dir < 0) h += 0.5; // 좌우반전
  if (mods.mini) h += 0.3; // 미니
  if (mods.speedLv > 0) h += mods.speedLv * 0.3; // 가속 단계당
  return h;
}

// 현재 상태에서 의미 있는(효과가 실제로 바뀌는) 포탈 후보 중 랜덤 선택
function pickPortalKind(): PortalKind {
  const g = stageGimmicks(stage);
  const candidates: PortalKind[] = [];
  if (g.grav) candidates.push(mods.gravFlip ? 'grav-off' : 'grav-on');
  if (g.mirror) candidates.push('mirror');
  if (g.mini) candidates.push(mods.mini ? 'mini-off' : 'mini-on');
  if (g.speed) {
    const speedPool: PortalKind[] = [];
    if (mods.speedLv < SPEED_MAX_LV) speedPool.push('speed-up');
    if (mods.speedLv > SPEED_MIN_LV) speedPool.push('speed-down');
    if (mods.speedLv !== 2) speedPool.push('speed-2');
    if (mods.speedLv !== 3) speedPool.push('speed-3');
    if (mods.speedLv !== 0) speedPool.push('speed-normal');
    candidates.push(speedPool[Math.floor(Math.random() * speedPool.length)]);
  }
  // 안전장치: 후보 없으면(이론상 stage<2) 미니로
  if (candidates.length === 0) candidates.push('mini-on');
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function spawnPortalKind(kind: PortalKind): void {
  // 기둥과 겹치지 않게: 파이프 격자의 '중간 지점'에 배치
  let lead: Pipe | null = null;
  for (const p of pipes) {
    if (lead === null || p.x * mods.dir > lead.x * mods.dir) lead = p;
  }
  const edge = spawnEdgeX(PORTAL_WIDTH);
  const sp = pipeSpacing();
  let px = lead ? lead.x + mods.dir * (sp / 2) : edge;
  // 아직 화면 안이면 선두 가장자리 너머로 한 칸(sp)씩 밀기 → 격자 중간 유지
  let guard = 0;
  while (guard++ < 8 && px * mods.dir < edge * mods.dir) {
    px += mods.dir * sp;
  }
  portals.push({ x: px, kind, applied: false });
}

// 파티클 분출 (타격감)
function burst(
  x: number,
  y: number,
  color: string,
  count: number,
  power: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = power * (0.4 + Math.random() * 0.8);
    const life = 0.3 + Math.random() * 0.4;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life,
      max: life,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

// 피격 — 목숨 차감 / 무적 / 화면 효과. 죽으면 true 반환
function loseLife(): boolean {
  lives--;
  combo = 0; // 피격 시 콤보 리셋
  invinc = INVINC_TIME;
  shake = 12;
  flash = 1;
  burst(birdScreenX(), birdY, '#F04452', 18, 320);
  if (lives <= 0) {
    gameOver();
    return true;
  }
  sounds.hit();
  haptic('error');
  return false;
}

// 스테이지 진입 — 생명 물약 + 배너 + 배경 전환
function enterStage(n: number): void {
  stage = n;
  if (lives < HEART_MAX) lives = Math.min(HEART_MAX, lives + 1);
  healPulse = 1;
  stageBanner = STAGE_BANNER_TIME;
  stageFlash = 1;
  burst(birdScreenX(), birdY, '#34C759', 18, 280);
  music.setStage(n);
  sounds.stage();
  haptic('success');
}

// 좌우(진행방향) 반전: 월드 전체를 거울처럼 미러링
function flipDirection(target: 1 | -1): void {
  if (mods.dir === target) return;
  mods.dir = target;
  for (const p of pipes) p.x = W - p.x - PIPE_WIDTH;
  for (const pt of portals) pt.x = W - pt.x - PORTAL_WIDTH;
}

function applyPortal(kind: PortalKind): void {
  switch (kind) {
    case 'grav-on':
      mods.gravFlip = true;
      break;
    case 'grav-off':
      mods.gravFlip = false;
      break;
    case 'mirror':
      flipDirection(mods.dir > 0 ? -1 : 1); // 토글: 반전 <-> 복구
      break;
    case 'mini-on':
      mods.mini = true;
      break;
    case 'mini-off':
      mods.mini = false;
      break;
    case 'speed-up':
      mods.speedLv = Math.min(SPEED_MAX_LV, mods.speedLv + 1);
      break;
    case 'speed-2':
      mods.speedLv = 2;
      break;
    case 'speed-3':
      mods.speedLv = 3;
      break;
    case 'speed-normal':
      mods.speedLv = 0;
      break;
    case 'speed-down':
      mods.speedLv = Math.max(SPEED_MIN_LV, mods.speedLv - 1);
      break;
  }
  sounds.portal();
  haptic('wiggle');
  burst(birdScreenX(), birdY, PORTAL_STYLE[kind].c, 14, 240);
  shake = Math.max(shake, 6);
}

function start(): void {
  state = 'playing';
  birdVel = mode === 'boat' ? 0 : flapVel();
  pipeAccum = 0;
  spawnPipe();
  music.start(stage);
  sounds.flap();
  haptic('tickWeak');
}

// 시작화면 모드 선택 버튼 영역
function modeButtons(): { bird: Rect; boat: Rect } {
  const bw = Math.min(150, (W - 56) / 2);
  const bh = 156;
  const gap = 18;
  const x0 = (W - (bw * 2 + gap)) / 2;
  const y = playH() * 0.4;
  return {
    bird: { x: x0, y, w: bw, h: bh },
    boat: { x: x0 + bw + gap, y, w: bw, h: bh },
  };
}
function inRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// 게임오버 카드/버튼 영역
function gameOverLayout(): { card: Rect; retry: Rect; rank: Rect } {
  const cardW = Math.min(320, W - 48);
  const cardH = 304;
  const cx = (W - cardW) / 2;
  const cy = H * 0.3 - cardH / 2;
  const btnW = cardW - 48;
  const btnH = 50;
  const bx = (W - btnW) / 2;
  const rankY = cy + cardH - btnH - 22;
  const retryY = rankY - btnH - 12;
  return {
    card: { x: cx, y: cy, w: cardW, h: cardH },
    retry: { x: bx, y: retryY, w: btnW, h: btnH },
    rank: { x: bx, y: rankY, w: btnW, h: btnH },
  };
}

// 시작화면 랭킹 버튼
function readyRankButton(): Rect {
  const b = modeButtons();
  const w = 160;
  const h = 42;
  return { x: (W - w) / 2, y: b.bird.y + b.bird.h + 54, w, h };
}

// 음소거 버튼 (우상단)
function muteButton(): Rect {
  return { x: W - 46, y: 16, w: 32, h: 32 };
}

// 리더보드 패널/탭/닫기 영역
function boardLayout(): { panel: Rect; tabBird: Rect; tabBoat: Rect; close: Rect } {
  const pw = Math.min(360, W - 28);
  const ph = Math.min(548, H - 100);
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  const tabW = (pw - 48) / 2;
  const tabY = py + 58;
  return {
    panel: { x: px, y: py, w: pw, h: ph },
    tabBird: { x: px + 24, y: tabY, w: tabW, h: 36 },
    tabBoat: { x: px + 24 + tabW, y: tabY, w: tabW, h: 36 },
    close: { x: px + pw - 46, y: py + 12, w: 34, h: 34 },
  };
}

function loadBoard(): void {
  boardRows = null;
  const m = boardMode;
  void lb.fetchBoard(m).then((rows) => {
    if (boardMode === m) boardRows = rows;
  });
}

function openBoard(m: CraftMode): void {
  // 온라인이면 닉네임 확보 후 현재 최고기록 등록
  if (lb.isOnline() && !lb.getNick()) {
    for (let tries = 0; tries < 5; tries++) {
      const raw = window.prompt('리더보드에 표시할 닉네임 (2~10자)') ?? '';
      if (!raw.trim()) break; // 취소
      const err = lb.nickError(raw);
      if (err) {
        window.alert(err);
        continue;
      }
      const n = raw.trim().slice(0, 10);
      lb.setNick(n);
      if (best.bird > 0) void lb.submitScore('bird', n, best.bird);
      if (best.boat > 0) void lb.submitScore('boat', n, best.boat);
      break;
    }
  }
  boardOpen = true;
  boardMode = m;
  loadBoard();
}

function flap(): void {
  birdVel = flapVel();
  wingPhase = 0;
  sounds.flap();
  haptic('tickWeak');
}

function gameOver(): void {
  state = 'gameover';
  gameOverAt = performance.now();
  music.stop();
  sounds.hit();
  if (score > best[mode]) {
    best[mode] = score;
    isNewBest = true;
    saveBest(mode, score);
    haptic('success');
    setTimeout(() => sounds.best(), 350);
    const nick = lb.getNick();
    if (nick) void lb.submitScore(mode, nick, score);
  } else {
    haptic('error');
  }
}

// ---------- 입력 ----------
function onPointerDown(px: number, py: number): void {
  sounds.unlock();
  music.unlock();
  // 음소거 버튼 (모든 화면)
  if (inRect(px, py, muteButton())) {
    music.setMuted(!music.isMuted());
    return;
  }
  // 리더보드가 열려 있으면 그 입력만 처리
  if (boardOpen) {
    const bl = boardLayout();
    if (inRect(px, py, bl.tabBird)) {
      boardMode = 'bird';
      loadBoard();
    } else if (inRect(px, py, bl.tabBoat)) {
      boardMode = 'boat';
      loadBoard();
    } else if (inRect(px, py, bl.close) || !inRect(px, py, bl.panel)) {
      boardOpen = false;
    }
    return;
  }
  pointerHeld = true;
  if (state === 'ready') {
    if (inRect(px, py, readyRankButton())) {
      openBoard(mode);
      return;
    }
    const b = modeButtons();
    if (inRect(px, py, b.bird)) {
      mode = 'bird';
      start();
    } else if (inRect(px, py, b.boat)) {
      mode = 'boat';
      start();
    }
  } else if (state === 'playing') {
    if (mode === 'bird') flap(); // 통통배는 누름 상태(pointerHeld)로 제어
  } else if (state === 'gameover') {
    if (performance.now() - gameOverAt <= 600) return;
    if (inRect(px, py, gameOverLayout().rank)) {
      openBoard(mode);
      return;
    }
    reset(); // 다시하기 버튼 포함 그 외 영역
  }
}
function onPointerUp(): void {
  pointerHeld = false;
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  onPointerDown(e.clientX, e.clientY);
});
canvas.addEventListener('pointerup', (e) => {
  e.preventDefault();
  onPointerUp();
});
canvas.addEventListener('pointercancel', () => onPointerUp());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (e.repeat) return;
    if (state === 'ready') {
      const b = modeButtons();
      onPointerDown(b.bird.x + 1, b.bird.y + 1); // 키보드는 통통새로 시작
    } else {
      onPointerDown(W / 2, H / 2);
    }
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') onPointerUp();
});

// ---------- 업데이트 ----------
function update(dt: number): void {
  // 구름은 항상 흐르게
  for (const c of clouds) {
    c.x -= c.speed * dt;
    if (c.x < -120) {
      c.x = W + 120;
      c.y = 40 + Math.random() * (playH() * 0.4);
    }
  }

  wingPhase += dt * 14;

  if (state !== 'playing') {
    if (state === 'ready') {
      // 대기 중 둥실거림
      birdY = playH() * 0.45 + Math.sin(performance.now() / 350) * 8;
    }
    return;
  }

  // 비행 물리 — 통통새: 플랩 점프 / 통통배: 누르면 상승·떼면 하강
  if (mode === 'boat') {
    const a = (pointerHeld ? -SHIP_ACCEL : SHIP_ACCEL) * (mods.gravFlip ? -1 : 1);
    birdVel += a * dt;
  } else {
    birdVel += gravity() * dt;
  }
  if (birdVel > TERMINAL_VEL) birdVel = TERMINAL_VEL;
  else if (birdVel < -TERMINAL_VEL) birdVel = -TERMINAL_VEL;
  birdY += birdVel * dt;

  const worldSpeed = currentSpeed() * speedMult();
  const moveX = worldSpeed * dt * mods.dir; // dir<0이면 오른쪽으로 흐름
  const birdX = birdScreenX();
  const r = birdRadius();

  // 파이프 이동 & 점수
  for (const p of pipes) {
    p.x -= moveX;
    if (!p.passed) {
      const cleared =
        mods.dir > 0 ? p.x + PIPE_WIDTH < birdX - r : p.x > birdX + r;
      if (cleared) {
        p.passed = true;
        pipesPassed++;
        combo++;
        score += Math.max(1, Math.round(comboMult() * hazardMult()));
        scorePop = 1;
        comboPop = 1;
        sounds.score();
        haptic('tickMedium');
      }
    }
  }

  // 스테이지 진행 (통과 기둥 STAGE_PIPES마다, 최대 MAX_STAGE)
  const wantStage = Math.min(MAX_STAGE, Math.floor(pipesPassed / STAGE_PIPES) + 1);
  if (wantStage > stage) enterStage(wantStage);

  // 포탈 이동
  for (const pt of portals) {
    pt.x -= moveX;
  }
  // 포탈 통과 판정 (좌우반전 시 새 위치가 바뀌므로 매번 birdX 재계산)
  let bx = birdScreenX();
  for (const pt of portals) {
    if (!pt.applied && bx > pt.x && bx < pt.x + PORTAL_WIDTH) {
      pt.applied = true;
      applyPortal(pt.kind);
      bx = birdScreenX();
    }
  }

  // 화면 밖 오브젝트 정리 (양방향)
  pipes = pipes.filter((p) => p.x > -PIPE_WIDTH - 80 && p.x < W + PIPE_WIDTH + 80);
  // 포탈은 격자 중간(가장자리보다 최대 한 칸 더 바깥, 속도 보정 시 더 넓어짐)에
  // 생성되므로 정리 여유를 최대 간격보다 넓게 둬야 생성 직후 삭제되지 않음
  const portalOff = PIPE_SPACING * 4 + PORTAL_WIDTH + 80;
  portals = portals.filter((p) => p.x > -portalOff && p.x < W + portalOff);

  // 파이프 스폰 (거리 누적 — 속도가 빠르면 간격도 부분 보정)
  pipeAccum += worldSpeed * dt;
  const curSpacing = pipeSpacing();
  if (pipeAccum >= curSpacing) {
    pipeAccum -= curSpacing;
    if (gravQueued) {
      // 중력반전: 기둥 하나를 생략하고 그 자리(격자)에 단독 포탈 → 적응 공간 확보
      portals.push({ x: spawnEdgeX(PORTAL_WIDTH), kind: gravQueued, applied: false });
      gravQueued = null;
    } else {
      spawnPipe();
    }
  }

  // 포탈 스폰 — 등장 전 예고(PORTAL_WARN_TIME) 후 실제 생성
  if (stage >= 2 && !pendingPortal && !gravQueued) {
    portalAccum += worldSpeed * dt;
    if (portalAccum >= nextPortalDist) {
      portalAccum = 0;
      const intensity = stage >= 6 ? 0.6 : 1; // 지옥: 포탈 더 잦게
      nextPortalDist =
        (PORTAL_MIN_DIST + Math.random() * PORTAL_RAND_DIST) * intensity;
      pendingPortal = { kind: pickPortalKind(), timer: PORTAL_WARN_TIME };
    }
  }
  if (pendingPortal) {
    pendingPortal.timer -= dt;
    if (pendingPortal.timer <= 0) {
      const k = pendingPortal.kind;
      if (k === 'grav-on' || k === 'grav-off') {
        gravQueued = k; // 다음 기둥 자리에 단독 생성
      } else {
        spawnPortalKind(k);
      }
      pendingPortal = null;
    }
  }

  // 타이머 & 파티클 갱신
  if (invinc > 0) invinc = Math.max(0, invinc - dt);
  if (shake > 0) shake = Math.max(0, shake - dt * 22);
  if (flash > 0) flash = Math.max(0, flash - dt * 3);
  if (scorePop > 0) scorePop = Math.max(0, scorePop - dt * 4);
  if (stageBanner > 0) stageBanner = Math.max(0, stageBanner - dt);
  if (stageFlash > 0) stageFlash = Math.max(0, stageFlash - dt * 1.6);
  if (healPulse > 0) healPulse = Math.max(0, healPulse - dt * 1.3);
  if (comboPop > 0) comboPop = Math.max(0, comboPop - dt * 4);
  for (const pa of particles) {
    pa.x -= moveX * 0.6; // 월드와 함께 약간 흐르게
    pa.x += pa.vx * dt;
    pa.y += pa.vy * dt;
    pa.vy += 600 * dt; // 중력
    pa.life -= dt;
  }
  particles = particles.filter((pa) => pa.life > 0);

  // 충돌 판정 — 포탈(미러/미니) 적용 후 새의 현재 위치·크기로 다시 계산
  const cx = birdScreenX();
  const cr = birdRadius();

  // 바닥: 항상 위로 튕김, 무적이 아니면 목숨 차감
  if (birdY + cr >= playH()) {
    birdY = playH() - cr;
    if (invinc <= 0 && loseLife()) return;
    birdVel = -Math.abs(FLAP_VELOCITY) * 0.85;
  }
  // 천장(부드럽게)
  if (birdY - cr <= 0) {
    birdY = cr;
    if (birdVel < 0) birdVel = 0;
  }
  // 파이프: 무적 동안은 통과
  if (invinc <= 0) {
    for (const p of pipes) {
      if (cx + cr > p.x && cx - cr < p.x + PIPE_WIDTH) {
        const top = p.gapY - p.gap / 2;
        const bottom = p.gapY + p.gap / 2;
        if (birdY - cr < top || birdY + cr > bottom) {
          loseLife();
          break;
        }
      }
    }
  }
}

// ---------- 그리기 ----------
function roundRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBackground(): void {
  const th = theme();
  const grad = ctx.createLinearGradient(0, 0, 0, playH());
  grad.addColorStop(0, th.skyTop);
  grad.addColorStop(1, th.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, playH());

  // 별 (밤/우주/오로라)
  if (th.stars) {
    ctx.fillStyle = '#FFFFFF';
    for (const st of stars) {
      const tw = 0.5 + 0.5 * Math.sin(performance.now() / 600 + st.p);
      ctx.globalAlpha = 0.35 + tw * 0.6;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 구름
  ctx.fillStyle = th.cloud;
  for (const c of clouds) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.scale, c.scale);
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.arc(24, -8, 18, 0, Math.PI * 2);
    ctx.arc(48, 0, 22, 0, Math.PI * 2);
    ctx.arc(24, 8, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 바닥
  ctx.fillStyle = th.ground;
  ctx.fillRect(0, playH(), W, GROUND_HEIGHT);
  ctx.fillStyle = th.groundLine;
  ctx.fillRect(0, playH(), W, 3);
}

function drawPipes(): void {
  for (const p of pipes) {
    const top = p.gapY - p.gap / 2;
    const bottom = p.gapY + p.gap / 2;

    ctx.fillStyle = COLOR.pipe;
    // 위 파이프
    roundRect(p.x, -20, PIPE_WIDTH, top + 20, 14);
    ctx.fill();
    // 아래 파이프
    roundRect(p.x, bottom, PIPE_WIDTH, playH() - bottom + 20, 14);
    ctx.fill();

    // 파이프 끝 캡
    ctx.fillStyle = COLOR.pipeCap;
    roundRect(p.x - 4, top - 22, PIPE_WIDTH + 8, 22, 10);
    ctx.fill();
    roundRect(p.x - 4, bottom, PIPE_WIDTH + 8, 22, 10);
    ctx.fill();
  }
}

function drawPortals(): void {
  const top = 28;
  const bottom = playH() - 28;
  const h = bottom - top;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);

  for (const pt of portals) {
    const s = PORTAL_STYLE[pt.kind];
    const cx = pt.x + PORTAL_WIDTH / 2;

    ctx.save();
    // 글로우
    ctx.shadowColor = s.c;
    ctx.shadowBlur = 14 + pulse * 12;

    // 반투명 내부
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = s.c;
    roundRect(pt.x, top, PORTAL_WIDTH, h, PORTAL_WIDTH / 2);
    ctx.fill();

    // 테두리 (포탈 링)
    ctx.globalAlpha = 1;
    ctx.lineWidth = 5;
    ctx.strokeStyle = s.c;
    roundRect(pt.x, top, PORTAL_WIDTH, h, PORTAL_WIDTH / 2);
    ctx.stroke();
    ctx.restore();

    // 아이콘/라벨 — 파이프 위에서도 읽히도록 흰 배경 칩 위에 그림
    const midY = playH() / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 배경 칩
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    roundRect(cx - PORTAL_WIDTH / 2 + 3, midY - 30, PORTAL_WIDTH - 6, 60, 14);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = s.c;
    roundRect(cx - PORTAL_WIDTH / 2 + 3, midY - 30, PORTAL_WIDTH - 6, 60, 14);
    ctx.stroke();
    // 아이콘
    ctx.fillStyle = s.c;
    ctx.font = '800 28px Pretendard, -apple-system, sans-serif';
    ctx.fillText(s.glyph, cx, midY - 11);
    // 라벨
    ctx.font = '800 11px Pretendard, -apple-system, sans-serif';
    ctx.fillText(s.label, cx, midY + 16);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
}

// 통통새 모양 (로컬 원점 기준)
function drawBirdShape(): void {
  ctx.fillStyle = COLOR.bird;
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  const wingY = Math.sin(wingPhase) * 4;
  ctx.fillStyle = COLOR.birdWing;
  ctx.beginPath();
  ctx.ellipse(-4, 3 + wingY, 9, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.birdBeak;
  ctx.beginPath();
  ctx.moveTo(BIRD_RADIUS - 3, -2);
  ctx.lineTo(BIRD_RADIUS + 8, 2);
  ctx.lineTo(BIRD_RADIUS - 3, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(6, -6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.text;
  ctx.beginPath();
  ctx.arc(7.5, -6, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

// 통통배 모양 (로컬 원점 기준)
function drawBoatShape(): void {
  // 돛대
  ctx.strokeStyle = COLOR.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1, -22);
  ctx.lineTo(-1, 8);
  ctx.stroke();
  // 돛 (삼각)
  ctx.fillStyle = COLOR.birdBeak;
  ctx.beginPath();
  ctx.moveTo(1, -21);
  ctx.lineTo(1, -1);
  ctx.lineTo(14, -4);
  ctx.closePath();
  ctx.fill();
  // 선체
  ctx.fillStyle = COLOR.bird;
  ctx.beginPath();
  ctx.moveTo(-17, 2);
  ctx.lineTo(17, 2);
  ctx.lineTo(11, 14);
  ctx.quadraticCurveTo(0, 17, -11, 14);
  ctx.closePath();
  ctx.fill();
  // 흰 띠
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  roundRect(-15, 3.5, 30, 3, 1.5);
  ctx.fill();
}

function drawBird(): void {
  if (state === 'ready') return; // 대기화면은 모드 선택 UI가 미리보기 표시
  const x = birdScreenX();
  const y = birdY;
  const r = birdRadius();
  const scale = r / BIRD_RADIUS;
  const baseTilt = Math.max(-0.45, Math.min(0.9, birdVel / 700));

  ctx.save();
  if (invinc > 0) {
    ctx.globalAlpha = 0.3 + 0.5 * (Math.sin(performance.now() / 55) * 0.5 + 0.5);
  }
  ctx.translate(x, y);
  ctx.scale(mods.dir > 0 ? scale : -scale, mods.gravFlip ? -scale : scale);
  ctx.rotate(baseTilt);
  if (mode === 'boat') drawBoatShape();
  else drawBirdShape();
  ctx.restore();
}

// 시작화면: 모드 선택
function drawModeCard(r: Rect, title: string, hint: string, kind: CraftMode, bob: number): void {
  ctx.save();
  ctx.fillStyle = COLOR.card;
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  roundRect(r.x, r.y, r.w, r.h, 20);
  ctx.fill();
  ctx.restore();
  // 미리보기
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h * 0.4 + bob);
  ctx.scale(1.3, 1.3);
  if (kind === 'boat') drawBoatShape();
  else drawBirdShape();
  ctx.restore();
  // 텍스트
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.text;
  ctx.font = '800 19px Pretendard, -apple-system, sans-serif';
  ctx.fillText(title, r.x + r.w / 2, r.y + r.h - 36);
  ctx.fillStyle = COLOR.subText;
  ctx.font = '600 13px Pretendard, -apple-system, sans-serif';
  ctx.fillText(hint, r.x + r.w / 2, r.y + r.h - 15);
}

function drawReady(): void {
  if (state !== 'ready') return;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.text;
  ctx.font = '800 30px Pretendard, -apple-system, sans-serif';
  ctx.fillText('통통 점프', W / 2, playH() * 0.26);
  ctx.fillStyle = COLOR.subText;
  ctx.font = '600 15px Pretendard, -apple-system, sans-serif';
  ctx.fillText('모드를 골라 시작해요', W / 2, playH() * 0.26 + 28);
  ctx.fillText('20점마다 새 기믹 해금! 6스테이지는 지옥 랜덤 조합', W / 2, playH() * 0.26 + 50);

  const b = modeButtons();
  const bob = Math.sin(performance.now() / 350) * 5;
  drawModeCard(b.bird, '통통새', '탭해서 점프', 'bird', bob);
  drawModeCard(b.boat, '통통배', '누르면 상승', 'boat', bob);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.subText;
  ctx.font = '600 14px Pretendard, -apple-system, sans-serif';
  ctx.fillText(`최고  통통새 ${best.bird} · 통통배 ${best.boat}`, W / 2, b.bird.y + b.bird.h + 28);
  // 랭킹 버튼
  const rb = readyRankButton();
  ctx.fillStyle = '#E8F0FE';
  roundRect(rb.x, rb.y, rb.w, rb.h, 14);
  ctx.fill();
  ctx.fillStyle = COLOR.button;
  ctx.font = '700 15px Pretendard, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏆 랭킹 보기', rb.x + rb.w / 2, rb.y + rb.h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

// 현재 활성 효과 배지 표시
function drawActiveBadges(): void {
  if (state !== 'playing') return;
  const items: { c: string; glyph: string; label: string }[] = [];
  const add = (k: PortalKind, label?: string): void => {
    const st = PORTAL_STYLE[k];
    items.push({ c: st.c, glyph: st.glyph, label: label ?? st.label });
  };
  if (mods.gravFlip) add('grav-on');
  if (mods.dir < 0) add('mirror');
  if (mods.mini) add('mini-on');
  if (mods.speedLv > 0) {
    add(mods.speedLv === 1 ? 'speed-up' : mods.speedLv === 2 ? 'speed-2' : 'speed-3');
  } else if (mods.speedLv < 0) add('speed-down');
  if (items.length === 0) return;

  const bw = 92;
  const bh = 26;
  const gap = 8;
  let by = 56;
  const bx = W - bw - 14;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const it of items) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = it.c;
    roundRect(bx, by, bw, bh, 13);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 13px Pretendard, -apple-system, sans-serif';
    ctx.fillText(`${it.glyph} ${it.label}`, bx + bw / 2, by + bh / 2 + 1);
    ctx.restore();
    by += bh + gap;
  }
  ctx.textBaseline = 'alphabetic';
}

function drawScore(): void {
  if (state !== 'playing') return;
  const th = theme();
  ctx.textAlign = 'center';
  const topY = playH() * 0.16;
  const popScale = 1 + scorePop * 0.35;
  ctx.save();
  ctx.translate(W / 2, topY);
  ctx.scale(popScale, popScale);
  ctx.fillStyle = th.fg;
  ctx.font = '800 56px Pretendard, -apple-system, sans-serif';
  ctx.fillText(String(score), 0, 0);
  ctx.restore();

  let y = topY + 30;
  const perPipe = Math.max(1, Math.round(comboMult() * hazardMult()));
  if (perPipe > 1) {
    const cp = 1 + comboPop * 0.45;
    ctx.save();
    ctx.translate(W / 2, y);
    ctx.scale(cp, cp);
    ctx.fillStyle = '#FF8A00';
    ctx.font = '800 18px Pretendard, -apple-system, sans-serif';
    const tag = combo >= COMBO_STEP ? `🔥${combo}  ` : '';
    ctx.fillText(`${tag}+${perPipe}점 / 기둥`, 0, 0);
    ctx.restore();
    y += 26;
  }
  ctx.fillStyle = th.fg;
  ctx.globalAlpha = 0.72;
  ctx.font = '700 13px Pretendard, -apple-system, sans-serif';
  ctx.fillText(`STAGE ${stage} · ${th.name}`, W / 2, y);
  ctx.globalAlpha = 1;
}

function drawGameOver(): void {
  if (state !== 'gameover') return;

  ctx.fillStyle = 'rgba(25, 31, 40, 0.4)';
  ctx.fillRect(0, 0, W, H);

  const L = gameOverLayout();
  const c = L.card;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = COLOR.card;
  roundRect(c.x, c.y, c.w, c.h, 24);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.subText;
  ctx.font = '600 15px Pretendard, -apple-system, sans-serif';
  ctx.fillText(mode === 'boat' ? '통통배 점수' : '통통새 점수', W / 2, c.y + 44);

  ctx.fillStyle = COLOR.text;
  ctx.font = '800 50px Pretendard, -apple-system, sans-serif';
  ctx.fillText(String(score), W / 2, c.y + 96);

  if (isNewBest) {
    ctx.fillStyle = COLOR.newBest;
    ctx.font = '700 15px Pretendard, -apple-system, sans-serif';
    ctx.fillText('🎉 신기록이에요!', W / 2, c.y + 124);
  } else {
    ctx.fillStyle = COLOR.subText;
    ctx.font = '600 15px Pretendard, -apple-system, sans-serif';
    ctx.fillText(`최고 기록 ${best[mode]}점`, W / 2, c.y + 124);
  }

  // 다시하기
  ctx.fillStyle = COLOR.button;
  roundRect(L.retry.x, L.retry.y, L.retry.w, L.retry.h, 14);
  ctx.fill();
  ctx.fillStyle = COLOR.buttonText;
  ctx.font = '700 17px Pretendard, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('다시하기', W / 2, L.retry.y + L.retry.h / 2 + 1);
  // 랭킹 보기
  ctx.fillStyle = '#E8F0FE';
  roundRect(L.rank.x, L.rank.y, L.rank.w, L.rank.h, 14);
  ctx.fill();
  ctx.fillStyle = COLOR.button;
  ctx.fillText('🏆 랭킹 보기', W / 2, L.rank.y + L.rank.h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

// 리더보드 패널
function drawBoard(): void {
  if (!boardOpen) return;
  ctx.fillStyle = 'rgba(25, 31, 40, 0.55)';
  ctx.fillRect(0, 0, W, H);
  const Lay = boardLayout();
  const pan = Lay.panel;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = COLOR.card;
  roundRect(pan.x, pan.y, pan.w, pan.h, 22);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = COLOR.text;
  ctx.font = '800 20px Pretendard, -apple-system, sans-serif';
  ctx.fillText('🏆 랭킹', pan.x + 24, pan.y + 38);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.subText;
  ctx.font = '700 22px Pretendard, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('×', Lay.close.x + Lay.close.w / 2, Lay.close.y + Lay.close.h / 2);
  ctx.textBaseline = 'alphabetic';

  const tabs: Array<[Rect, string, CraftMode]> = [
    [Lay.tabBird, '통통새', 'bird'],
    [Lay.tabBoat, '통통배', 'boat'],
  ];
  for (const [r, label, m] of tabs) {
    const on = boardMode === m;
    ctx.fillStyle = on ? COLOR.button : '#F2F4F6';
    roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.fillStyle = on ? '#FFFFFF' : COLOR.subText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 14px Pretendard, -apple-system, sans-serif';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  }
  ctx.textBaseline = 'alphabetic';

  const listTop = Lay.tabBird.y + Lay.tabBird.h + 18;
  const nick = lb.getNick();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.subText;
  ctx.font = '600 14px Pretendard, -apple-system, sans-serif';
  if (!lb.isOnline()) {
    ctx.fillText('온라인 리더보드가 아직 설정되지 않았어요', W / 2, listTop + 38);
    ctx.fillText('Supabase 키를 넣으면 전체 순위가 보여요', W / 2, listTop + 62);
  } else if (boardRows === null) {
    ctx.fillText('불러오는 중…', W / 2, listTop + 38);
  } else if (boardRows.length === 0) {
    ctx.fillText('아직 기록이 없어요. 1등이 되어보세요!', W / 2, listTop + 38);
  } else {
    const rowH = 34;
    const room = Math.floor((pan.y + pan.h - 58 - listTop) / rowH);
    const maxRows = Math.min(boardRows.length, room);
    for (let i = 0; i < maxRows; i++) {
      const row = boardRows[i];
      const ry = listTop + i * rowH;
      if (row.name === nick) {
        ctx.fillStyle = '#E8F0FE';
        roundRect(pan.x + 16, ry - 2, pan.w - 32, rowH - 4, 9);
        ctx.fill();
      }
      ctx.textBaseline = 'middle';
      const yc = ry + rowH / 2 - 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = i < 3 ? COLOR.newBest : COLOR.subText;
      ctx.font = '800 14px Pretendard, -apple-system, sans-serif';
      ctx.fillText(`${i + 1}`, pan.x + 26, yc);
      ctx.fillStyle = COLOR.text;
      ctx.font = '700 14px Pretendard, -apple-system, sans-serif';
      ctx.fillText(row.name, pan.x + 56, yc);
      ctx.textAlign = 'right';
      ctx.fillText(`${row.score}`, pan.x + pan.w - 26, yc);
    }
    ctx.textBaseline = 'alphabetic';
  }

  let myRank = -1;
  if (boardRows) {
    const idx = boardRows.findIndex((r) => r.name === nick);
    if (idx >= 0) myRank = idx + 1;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.subText;
  ctx.font = '700 14px Pretendard, -apple-system, sans-serif';
  const rankTxt = lb.isOnline() ? (myRank > 0 ? `${myRank}위` : '순위권 밖') : '로컬 기록';
  ctx.fillText(`내 최고 ${best[boardMode]}점 · ${rankTxt}`, W / 2, pan.y + pan.h - 22);
}

function drawParticles(): void {
  for (const pa of particles) {
    ctx.globalAlpha = Math.max(0, pa.life / pa.max);
    ctx.fillStyle = pa.color;
    ctx.beginPath();
    ctx.arc(pa.x, pa.y, pa.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// 남은 목숨 하트
function drawHearts(): void {
  if (state === 'gameover') return;
  const r = 8.5;
  const gap = 23;
  const x0 = 16 + r;
  const y0 = 24 + r;
  for (let i = 0; i < HEART_MAX; i++) {
    const filled = i < lives;
    ctx.save();
    ctx.translate(x0 + i * gap, y0);
    if (filled && healPulse > 0 && i === lives - 1) {
      const sc = 1 + healPulse * 0.5;
      ctx.scale(sc, sc);
    }
    ctx.fillStyle = filled ? '#F04452' : 'rgba(139,149,161,0.26)';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.72);
    ctx.bezierCurveTo(-r * 1.3, -r * 0.3, -r * 0.5, -r * 1.1, 0, -r * 0.4);
    ctx.bezierCurveTo(r * 0.5, -r * 1.1, r * 1.3, -r * 0.3, 0, r * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// 스테이지 전환 배너
function drawStageBanner(): void {
  if (stageBanner <= 0 || state !== 'playing') return;
  const th = theme();
  const t = STAGE_BANNER_TIME - stageBanner;
  const a = Math.max(0, Math.min(1, Math.min(t / 0.25, stageBanner / 0.35)));
  const y = playH() * 0.34;
  const bw = 230;
  const bh = 88;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(25,31,40,0.82)';
  roundRect(W / 2 - bw / 2, y - bh / 2, bw, bh, 18);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 27px Pretendard, -apple-system, sans-serif';
  ctx.fillText(`STAGE ${stage}`, W / 2, y - 4);
  ctx.fillStyle = '#FFD7DE';
  ctx.font = '700 15px Pretendard, -apple-system, sans-serif';
  const intro = stageIntro(stage);
  ctx.fillText(
    intro ? `${intro}  💊+1` : `${th.name} · 💊 생명 +1`,
    W / 2,
    y + 24,
  );
  ctx.restore();
}

// 음소거 버튼
function drawMute(): void {
  const r = muteButton();
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 21px Pretendard, -apple-system, sans-serif';
  ctx.fillText(music.isMuted() ? '🔇' : '🔊', r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

// 포탈 등장 예고 (배너 + 방향 화살표)
function drawPortalWarning(): void {
  const warnKind = pendingPortal?.kind ?? gravQueued;
  if (!warnKind || state !== 'playing') return;
  const s2 = PORTAL_STYLE[warnKind];
  const blink = 0.55 + 0.45 * Math.sin(performance.now() / 90);
  const fromRight = mods.dir > 0;
  const y = playH() * 0.32;
  const bw = 156;
  const bh = 38;

  ctx.save();
  ctx.globalAlpha = blink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = s2.c;
  roundRect(W / 2 - bw / 2, y - bh / 2, bw, bh, 19);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 15px Pretendard, -apple-system, sans-serif';
  ctx.fillText(`${s2.glyph} ${s2.label} 주의!`, W / 2, y + 1);
  // 등장 방향 화살표
  ctx.font = '800 34px Pretendard, -apple-system, sans-serif';
  ctx.fillStyle = s2.c;
  ctx.fillText(fromRight ? '◀' : '▶', fromRight ? W - 26 : 26, playH() / 2);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

// ---------- 메인 루프 ----------
function frame(now: number): void {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0.016);
  lastTime = now;

  update(dt);

  // 화면 흔들림
  let sx = 0;
  let sy = 0;
  if (shake > 0) {
    sx = (Math.random() - 0.5) * shake;
    sy = (Math.random() - 0.5) * shake;
  }
  ctx.save();
  ctx.translate(sx, sy);

  drawBackground();
  drawPipes();
  drawPortals();
  drawParticles();
  drawBird();
  drawPortalWarning();
  drawScore();
  drawActiveBadges();
  drawHearts();
  drawReady();

  ctx.restore();

  // 피격 플래시 (흔들림과 무관하게 전체 화면)
  if (flash > 0) {
    ctx.fillStyle = `rgba(240, 68, 82, ${flash * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }
  // 스테이지 전환 플래시
  if (stageFlash > 0) {
    ctx.fillStyle = `rgba(255, 214, 120, ${stageFlash * 0.4})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawStageBanner();
  drawGameOver();
  drawBoard();
  drawMute();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
