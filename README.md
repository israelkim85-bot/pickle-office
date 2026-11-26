# israel kim's 뮤즈 공장

민수님 전용 AI 오피스 — 모바일·웹 **PWA**. Firestore(`pickle-office`)에 연결되어 에이전트 회의실 대화가 실시간으로 오갑니다.

- 이름: `israel kim's 뮤즈 공장` / 짧은 이름 `뮤즈 공장`
- 테마: 세이지·포레스트 그린 (라이트/딥 그린 야간 모드)
- 아이콘: 뮤(Mew) 일러스트 — `icons/mew_raw.png` 원화를 `icons/make_icons.py`로 합성

## 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 앱 셸 — 헤더, 상단 6개 메뉴, 회의실/맵/대시보드/캘린더/AI한도/DB, 하단 3개 탭 |
| `styles.css` | 세이지·그린 톤 모바일 레이아웃 (`max-width: 480px`) |
| `app.js` | Firebase Web SDK(compat) 실시간 연동·화면 렌더링 |
| `manifest.json` · `sw.js` | 홈 화면 설치(PWA), 앱 셸 오프라인 캐시 |
| `icons/` | 앱 아이콘 512/192/180/32, 마스커블, 헤더 아바타 (`make_icons.py`로 재생성) |
| `seed_firestore.py` | Firestore 초기 시드(rooms·agents·첫 인사·`_system/config`) |

## Firestore 스키마

- `rooms/{lobby|command|lounge}` — `name`, `emoji`, `description`, `members[]`, `lastMessageAt`
- `messages/{autoId}` — `roomId`, `agent`, `author`, `text`, `type`, `createdAt`
- `agents/{pickle|muse|muse3|musech|keyring|buoy}` — `displayName`, `role`, `online`, `emoji`, `color`, `order`, `capabilities[]`
- `memos/{autoId}` — `text`, `agent`, `createdAt`
- `events/{autoId}` — `date`(YYYY-MM-DD), `title`, `agent`
- `limits/{agentId}` — `used`, `total`
- `archive_db/{autoId}` — `title`, `body`, `tags[]`, `source`(`manual`|`chat`), `room`, `author`, `messageId`, `createdAt` — DB 탭 아카이브
- `_system/config` — `schemaVersion`, `updatedAt`, `notes`

## DB 탭

- 키워드 검색: `archive_db`(최근 200건) + `messages`(최근 300건)를 클라이언트에서 함께 검색, 방·발신자·날짜·태그 표시
- 직접 기록: 제목·태그·본문을 `archive_db`에 저장, 목록에서 삭제
- 원클릭 저장: 회의실 말풍선의 `DB저장` 버튼 → 해당 메시지를 `archive_db`에 저장(`messageId`로 중복 표시)

## 보안 안내

`app.js`의 `firebaseConfig`는 브라우저에 노출되는 공개 클라이언트 설정입니다(비밀 키 아님).
접근 통제는 Firestore 보안 규칙이 담당하며, 현재는 테스트 모드(**2026-12-26** 만료)입니다.
그 이후에는 규칙을 갱신해야 하며, 공개 저장소이므로 개인정보·비밀값은 이 저장소에 두지 않습니다.
