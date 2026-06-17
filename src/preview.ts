// BGM 미리듣기 페이지 — 게임 없이 음악만 재생
import * as music from './music';

let nowEl: HTMLElement | null = null;
function setNow(s: string): void {
  if (nowEl) nowEl.textContent = s;
}

function makeBtn(label: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = 'b';
  b.addEventListener('click', () => {
    music.unlock();
    fn();
  });
  return b;
}

window.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (!app) return;

  const grid = document.createElement('div');
  grid.className = 'grid';
  const names = [
    '1 · 아침 하늘',
    '2 · 노을',
    '3 · 밤하늘',
    '4 · 우주',
    '5 · 오로라',
    '6 · 지옥 (루프)',
  ];
  names.forEach((nm, i) => {
    grid.appendChild(
      makeBtn(nm, () => {
        music.start(i + 1);
        setNow('재생 중: ' + nm);
      }),
    );
  });
  app.appendChild(grid);

  const row = document.createElement('div');
  row.className = 'row';
  row.appendChild(
    makeBtn('🔥 지옥 인트로부터 (토카타 BWV 565)', () => {
      music.start(5);
      music.setStage(6);
      setNow('재생 중: 지옥 인트로 → 비트 드랍');
    }),
  );
  row.appendChild(
    makeBtn('⏹ 정지', () => {
      music.stop();
      setNow('정지됨');
    }),
  );
  const mute = makeBtn(music.isMuted() ? '🔇 음소거 해제' : '🔊 음소거', () => {
    music.setMuted(!music.isMuted());
    mute.textContent = music.isMuted() ? '🔇 음소거 해제' : '🔊 음소거';
  });
  row.appendChild(mute);
  app.appendChild(row);

  nowEl = document.createElement('div');
  nowEl.className = 'now';
  nowEl.textContent = '버튼을 눌러 들어보세요 (스테이지를 바꾸면 즉시 전환)';
  app.appendChild(nowEl);
});
