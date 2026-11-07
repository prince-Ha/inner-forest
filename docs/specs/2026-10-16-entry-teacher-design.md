# 완성본 2단계: 입장 화면 + 선생님 모드 + 일시정지·홈 + 완주 증명서

- 작성일: 2026-10-16 · 상태: **구현 완료** (자동 테스트 138개, 아티팩트 v10) · 앞 단계: `2026-10-15-full-600-quiz-design.md`
- 진행 기록·결정: `docs/plans/2026-10-16-entry-teacher-progress.md`
- 사용자 선호: 문서 검토 대신 채팅 요약 + 한 번 클릭 승인 (메모리 no-doc-reviews)

## 결정 (사용자 답)

| 항목 | 결정 |
|---|---|
| 학생 정보 | 이름 + 반 (3학년만). 반 개수는 `config.js` `school.classCount` (기본 10). 학생 ID = `3-반-이름` |
| 캐릭터 | 치이카와·하치와레·우사기·랏코 4명 도트(16×24). 사용자가 교육용·비영리라며 원작 캐릭터를 원함(저작권 위험 안내함). 그림은 `js/characters.js` 한 파일에 분리 → 바꾸기 쉽게 |
| 일시정지 | 세상·등반 시간 멈춤(15분 제한에 안 들어감), 전체 시간에는 들어감 |
| 홈 버튼 | 확인 창 → 처음 화면. 그만둔 판도 최고 층은 미완주 기록(3단계에서 시트로) |
| 선생님 모드 | 비밀번호 6666(`config.js` `teacher.password`). 안에: 테스트 모드, 설정 요약, 구글 시트 연결 확인(자리만) |
| 테스트 모드 | 켜면 HUD에 "테스트", 시작 화면에 구간 연습 버튼, 일시정지 메뉴에 층 이동·봇·퀴즈 건너뛰기. 테스트 판은 기록하지 않음. 학생 화면에서는 구간 연습 버튼 없음 |
| 증명서 | 완주 화면 [증명서 보기] → 이름·3학년 n반·날짜·등반 시간·점수·퀴즈·캐릭터 그림. [사진으로 저장](PNG). 테스트·연습 판은 "테스트" 표시 |

## 화면 흐름

처음(입장) 화면 → [시작하기] → 준비 화면(◀▶ 안내) → 게임 → 결과 화면(완주/시간 종료) → [증명서 보기]/[다시 하기]/[처음 화면].
게임 중 HUD 왼쪽 위: 소리 · ⏸ · 🏠. 일시정지 상자: [계속하기] [처음 화면으로] (+ 테스트 모드면 층 이동·봇·퀴즈 건너뛰기).
처음 화면 구석의 [선생님] → 비밀번호 → 선생님 상자.

## 구조

| 파일 | 역할 |
|---|---|
| `js/characters.js` (새) | `SF.CHARACTERS`: `{ id, name, pal, ears:[A,B], head, body, bodyUp }` ×4 |
| `js/student.js` (새) | `SF.classOptions(cfg)`, `SF.validateStudent(s, cfg)`, `SF.studentId(s, cfg)`, `SF.loadStudent(storage)`, `SF.saveStudent(storage, s)`, `SF.checkTeacherPassword(cfg, input)`, `SF.makeRecord(run, cfg, now)` |
| `js/certificate.js` (새) | `SF.certificateLines(data)`(글자, 테스트 가능), `SF.drawCertificate(data, sprites) → canvas` |
| `js/ui.js` (새) | 처음 화면·일시정지·확인·선생님·증명서 상자 DOM 연결 (game API만 부름) |
| `js/sprites.js` | 캐릭터 프레임 빌더를 정의 하나로 받게, `buildSprites().characters` |
| `js/render.js` | `frame.charId`로 캐릭터 고르기 |
| `js/game.js` | 상태 `home`·`paused` 추가, `game.begin(student, charId)`, `pause/unpause`, `quitToHome()`, `testMode`, 판 끝날 때 `makeRecord` → `game.lastRecord` (3단계에서 전송) |
| `config.js` | `school: { grade: 3, classCount: 10 }`, `teacher: { password: '6666' }` + `checkConfig` |

## 테스트

학생 정보 검사(빈 이름, 10자 초과, 반 범위), 학생 ID, 저장·불러오기(저장소가 막혀도 동작), 비밀번호, 기록 만들기(완주/그만둠/테스트), 캐릭터 4명 프레임 크기·좌우, 증명서 글자, 설정 검사. 브라우저: 입장 → 게임 → 일시정지(시간 멈춤) → 홈(확인) → 선생님 모드 → 테스트 모드 → 완주 → 증명서 → 저장, 폰 크기.
