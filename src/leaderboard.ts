// 넷리파이(일반 웹)용 리더보드 — Supabase REST 사용.
// 설정이 없으면 온라인 기능은 조용히 비활성화되고 로컬 점수만 동작해요.
export type Mode = 'bird' | 'boat';
export interface BoardRow {
  name: string;
  score: number;
}

interface Cfg {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function cfg(): Cfg | null {
  const c = (window as unknown as { AIT_LEADERBOARD?: Cfg }).AIT_LEADERBOARD;
  if (c && c.supabaseUrl && c.supabaseAnonKey) return c;
  return null;
}

export function isOnline(): boolean {
  return cfg() !== null;
}

// 차단 닉네임 (비속어). 부분 일치, 공백·대소문자 무시.
const BANNED: string[] = [
  '시발', '씨발', '씨바', '시바', 'ㅅㅂ', '병신', 'ㅂㅅ', '지랄', 'ㅈㄹ',
  '좆', '존나', '개새', '새끼', '꺼져', '닥쳐', '보지', '자지', '섹스',
  '썅', '엠창', '느금', '니애미', '창녀', '걸레', '등신', '한남', '김치녀',
  '된장녀', '페미', '일베', '운지',
  'fuck', 'fck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cunt',
  'sex', 'porn', 'nigger', 'faggot', 'bastard',
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

export function isBannedName(name: string): boolean {
  const n = normalize(name);
  if (!n) return true;
  return BANNED.some((w) => n.includes(normalize(w)));
}

// 닉네임 검증: 통과하면 null, 실패하면 사유 메시지
export function nickError(raw: string): string | null {
  const n = raw.trim();
  if (n.length < 2) return '닉네임은 2자 이상이어야 해요';
  if (n.length > 10) return '닉네임은 최대 10자예요';
  if (isBannedName(n)) return '사용할 수 없는 닉네임이에요';
  return null;
}

const NICK_KEY = 'ait-nick';
export function getNick(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? '';
  } catch {
    return '';
  }
}
export function setNick(n: string): void {
  try {
    localStorage.setItem(NICK_KEY, n);
  } catch {
    // 무시
  }
}

function headers(c: Cfg): Record<string, string> {
  return {
    apikey: c.supabaseAnonKey,
    Authorization: `Bearer ${c.supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };
}

// 점수 제출 (개인 최고 갱신 시에만 호출 권장)
export async function submitScore(
  mode: Mode,
  name: string,
  score: number,
): Promise<void> {
  const c = cfg();
  if (!c || !name || score <= 0 || isBannedName(name)) return;
  try {
    await fetch(`${c.supabaseUrl}/rest/v1/scores`, {
      method: 'POST',
      headers: { ...headers(c), Prefer: 'return=minimal' },
      body: JSON.stringify({ name, mode, score }),
    });
  } catch {
    // 네트워크 실패는 조용히 무시
  }
}

// 상위 랭킹 (이름별 최고점만 남겨 중복 제거)
export async function fetchBoard(mode: Mode): Promise<BoardRow[]> {
  const c = cfg();
  if (!c) return [];
  try {
    const res = await fetch(
      `${c.supabaseUrl}/rest/v1/scores?mode=eq.${mode}&order=score.desc&limit=300&select=name,score`,
      { headers: headers(c) },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as BoardRow[];
    const seen = new Set<string>();
    const out: BoardRow[] = [];
    for (const r of rows) {
      if (seen.has(r.name)) continue;
      seen.add(r.name);
      out.push({ name: r.name, score: r.score });
      if (out.length >= 50) break;
    }
    return out;
  } catch {
    return [];
  }
}
