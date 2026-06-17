# 넷리파이 리더보드 설정 (Supabase)

넷리파이 같은 일반 웹에서 "누가 1등인지" 보이는 공유 리더보드를 켜는 방법이에요.
서버를 직접 돌리는 게 아니라, 브라우저에서 바로 쓰는 무료 클라우드 DB(Supabase)에 점수만 저장하는 구조예요.

소요 시간: 약 5분.

## 1. Supabase 프로젝트 만들기

1. https://supabase.com 가입 → **New project** 생성 (Region은 `Northeast Asia (Seoul)` 추천)
2. 프로젝트가 만들어지면 **Project Settings → API** 로 이동
3. 두 값을 복사해 둬요:
   - **Project URL** (예: `https://abcd1234.supabase.co`)
   - **anon public** 키 (`service_role` 아님 — 반드시 anon public)

## 2. 점수 테이블 만들기

좌측 메뉴 **SQL Editor → New query** 에 아래를 붙여넣고 **Run**:

```sql
create table if not exists scores (
  id bigint generated always as identity primary key,
  name text not null,
  mode text not null check (mode in ('bird','boat')),
  score int not null,
  created_at timestamptz default now()
);

alter table scores enable row level security;

-- 누구나 순위 읽기 가능
create policy "read scores" on scores
  for select using (true);

-- 누구나 점수 제출 가능 (익명 데모용)
create policy "insert scores" on scores
  for insert with check (true);

create index if not exists scores_mode_score_idx on scores (mode, score desc);
```

## 3. 키 넣기

`index.html`(넷리파이에 올리는 파일) 위쪽의 설정 블록을 채워요:

```html
<script>
  window.AIT_LEADERBOARD = {
    supabaseUrl: "https://abcd1234.supabase.co",
    supabaseAnonKey: "여기에-anon-public-키"
  };
</script>
```

> 두 값을 비워두면 온라인 순위 없이 로컬(내 점수)만 동작해요.
> 직접 넣기 번거로우면 두 값만 알려주시면 제가 빌드에 박아서 바로 배포되는 zip을 드릴게요.

## 4. 넷리파이에 다시 올리기

수정한 파일을 https://app.netlify.com/drop 에 다시 끌어다 놓으면 끝.
게임오버 화면이나 시작 화면의 **🏆 랭킹 보기**를 누르면 닉네임을 입력하고,
통통새/통통배 각각의 전체 순위와 내 등수가 보여요.

## 참고

- 닉네임은 브라우저에 저장되고, 개인 최고 기록을 갱신할 때만 서버에 올라가요.
- anon 키는 공개되어도 되는 키예요(브라우저용). 다만 위 정책은 "누구나 제출 가능"이라
  데모/소규모용이에요. 악용이 걱정되면 나중에 앱인토스 게임 로그인 + 게임센터 리더보드로
  옮기면 사용자 식별까지 안전하게 처리돼요(토스 앱 안에서 동작).
