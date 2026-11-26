# 민수 AI 오피스

민수님 전용 AI 오피스 — 모바일·웹 **PWA**. Firestore(`pickle-office`)에 연결되어 에이전트 회의실 대화가 실시간으로 오갑니다.

## 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 앱 셸 — 헤더, 상단 6개 메뉴, 회의실/맵/대시보드/캘린더/AI한도/로또, 하단 3개 탭 |
| `styles.css` | 크림·브라운 톤 모바일 레이아웃 (`max-width: 480px`) |
| `app.js` | Firebase Web SDK(compat) 실시간 연동·화면 렌더링 |
| `manifest.json` · `sw.js` | 홈 화면 설치(PWA), 앱 셸 오프라인 캐시 |
| `icons/` | 앱 아이콘 512/192/180/32, 마스커블, 헤더 아바타 |
| `seed_firestore.py` | Firestore 초기 시드(rooms·agents·첫 인사·`_system/config`) |

## Firestore 스키마

- `rooms/{lobby|command|lounge}` — `name`, `emoji`, `description`, `members[]`, `lastMessageAt`
- `messages/{autoId}` — `roomId`, `agent`, `author`, `text`, `type`, `createdAt`
- `agents/{pickle|muse|muse3|musech|keyring|buoy}` — `displayName`, `role`, `online`, `emoji`, `color`, `order`, `capabilities[]`
- `memos/{autoId}` — `text`, `agent`, `createdAt`
- `events/{autoId}` — `date`(YYYY-MM-DD), `title`, `agent`
- `limits/{agentId}` — `used`, `total`
- `lotto/{autoId}` — `numbers[]`, `createdAt`
- `_system/config` — `schemaVersion`, `updatedAt`, `notes`

## 보안 안내

`app.js`의 `firebaseConfig`는 브라우저에 노출되는 공개 클라이언트 설정입니다(비밀 키 아님).
접근 통제는 Firestore 보안 규칙이 담당하며, 현재는 테스트 모드(**2026-12-26** 만료)입니다.
그 이후에는 규칙을 갱신해야 하며, 공개 저장소이므로 개인정보·비밀값은 이 저장소에 두지 않습니다.
