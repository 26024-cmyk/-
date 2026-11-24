# 팔레오 클래시 — 고생물 배틀 도감

45종 고생물을 모아 융합하고, 같은 레벨에서 공정하게 싸우는 턴제 배틀 도감 게임입니다.
빌드 도구 없이 순수 HTML/CSS/JS로 동작하며, GitHub Pages에 그대로 올릴 수 있습니다.

## 게임 구성

| 화면 | 내용 |
| --- | --- |
| 도감 | 45종(고생대·중생대·신생대 각 15종) 카드, 보유/미보유, 상세 정보·능력치·고유 스킬 |
| 전투 | 보유 생물로 1:1 턴제 배틀, 승리 시 코인·순위 점수 |
| 상점 | 코인으로 카드팩(3장) 개봉, 중복은 융합 재료 |
| 융합 | 모든 생물을 같은 종 2마리로 ★5까지 강화 |
| 순위 | 닉네임으로 기록을 올리고 다른 플레이어와 실시간 경쟁 |

- 시작 코인 300, 카드팩 100코인
- 승리 보상: 코인 35 + 상대 등급×7, 순위 점수 12 + 등급×2
- 패배 보상: 코인 12, 순위 점수 -4 (0 미만으로 내려가지 않음)
- 카드팩 확률: ★1 34% · ★2 30% · ★3 23% · ★4 13%
- 융합: 같은 종 2마리 소모, 1성당 능력치 28% 상승, 최대 ★5

## 전투 밸런스

전투 계산은 `js/combat.js` 한 곳에서만 이루어지며, 게임과 검증 스크립트가 같은 코드를 사용합니다.

- 데미지: `공격력 × 2.6 × 120/(120+방어력) × 계수`
- 속도: 턴 순서, 회피(최대 18%), 치명타(최대 20%, 1.5배)
- 동일 레벨 1:1, 45종 전체 상호 대전(쌍방 20판) 검증 결과
  - 승률 범위 **41.7% ~ 60.9%**
  - 등급별 평균 ★1 51.2% · ★2 49.6% · ★3 50.9% · ★4 49.2%
  - 무승부 0.04%
- 전투 상대는 등급이 아니라 `Combat.power` 기준으로 가까운 전력 6종 중에서 매칭됩니다.

## 로컬 실행

정적 파일이라 별도 빌드가 필요 없습니다.

```bash
# 게임 (http://localhost:3000)
python3 -m http.server 3000

# 순위 서버 (http://localhost:8080)
cd server && PORT=8080 node server.js
```

로컬에서 순위 서버를 쓰려면 `js/config.js`의 `apiBase`를 `http://localhost:8080`으로 바꿉니다.
(비워 두면 로컬 기록 모드로 동작합니다.)

## Render 배포 — 실시간 순위 서버

`server/`는 외부 패키지가 없는 Node 18+ HTTP 서버입니다. 아래 순서대로 하면 됩니다.

### 1. 저장소 확인

```bash
git add .
git commit -m "실시간 순위 서버 추가"
git push origin main
```

### 2. Render 웹 서비스 생성

1. <https://dashboard.render.com> 로그인 → **New +** → **Web Service**
2. **Build and deploy from a Git repository** → GitHub 연결 → `26024-cmyk/-` 선택
3. 아래 값을 입력합니다.

| 항목 | 값 |
| --- | --- |
| Name | `paleo-clash-api` |
| Region | Singapore (또는 가까운 지역) |
| Root Directory | `server` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | `Free` |

4. **Environment Variables** 추가

| Key | Value |
| --- | --- |
| `ALLOWED_ORIGIN` | `https://26024-cmyk.github.io` |
| `NODE_VERSION` | `20.11.1` |

5. **Create Web Service** → 첫 배포가 끝날 때까지 대기 (2~3분)

`render.yaml` 블루프린트를 쓰려면 **New + → Blueprint**에서 이 저장소를 선택해도 됩니다.

### 3. 서버 주소 연결

배포가 끝나면 상단에 `https://paleo-clash-api.onrender.com` 같은 주소가 표시됩니다.

1. `js/config.js`를 엽니다.
2. `apiBase`에 주소를 넣습니다.

```js
window.PALEO_CONFIG = {
  apiBase: 'https://paleo-clash-api.onrender.com',
};
```

3. 커밋 후 `main`에 푸시합니다.

GitHub Pages는 푸시 후 20초 안에 자동 반영됩니다.
순위 탭에서 닉네임을 정하고 **기록 올리기**를 누르면 전체 순위에 등록됩니다.

### 4. 동작 확인

```bash
curl https://paleo-clash-api.onrender.com/health
curl https://paleo-clash-api.onrender.com/api/leaderboard
```

- `/health` → `{"ok":true,...}`
- 두 브라우저(또는 시크릿 창)에서 각각 기록을 올리면 순위가 실시간으로 갱신됩니다.

### Render 무료 플랜 주의사항

- 15분간 요청이 없으면 서비스가 잠들고, 다음 요청에 30초 정도 걸릴 수 있습니다.
- 무료 인스턴스는 재배포 시 파일이 초기화됩니다. 기록을 오래 보관하려면
  **Disks**에서 1GB 디스크를 `/var/data`에 붙이고 환경 변수
  `DATA_FILE=/var/data/leaderboard.json`을 추가하세요. (유료 플랜 필요)
- 무료 플랜은 월 사용량 한도가 있습니다. 개인 테스트 용도로 적합합니다.

## GitHub Pages

- 배포 워크플로: `.github/workflows/pages.yml`
- 주소: <https://26024-cmyk.github.io/-/>
- `main` 브랜치에 푸시하면 자동 배포됩니다.
- 저장소 Settings → Pages → Source가 **GitHub Actions**인지 확인하세요.

## API 명세

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/health` | 상태 확인 |
| GET | `/api/leaderboard` | 상위 50명 순위 |
| POST | `/api/score` | `{ name, score, wins, packs }` 등록 (이름 기준 최고 기록 유지) |
| GET | `/api/stream` | SSE 실시간 순위 스트림 |

- 이름은 최대 12자, 점수는 0~10,000,000 사이만 허용합니다.
- 같은 IP에서 2.5초에 한 번만 등록할 수 있습니다.
- 데이터는 `DATA_FILE`(기본 `server/leaderboard.json`)에 저장됩니다.

## 파일 구조

```
index.html          화면 마크업
styles.css          전체 스타일
js/config.js        순위 서버 주소 설정
js/data.js          45종 데이터(능력치·스킬·설명)
js/combat.js        전투 계산 단일 구현(게임/검증 공용)
js/models.js        45종 절차 생성 모델
js/game.js          도감·전투·상점·융합·순위 UI
js/online.js        순위 API 클라이언트(SSE)
server/server.js    순위 서버(의존성 없음)
render.yaml         Render 블루프린트
```
