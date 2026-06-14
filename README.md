# AR 무안 갯벌 탐험

기획서 원안을 바탕으로 제작한 독립형 모바일 Web-AR 수집 게임입니다.

## 주요 기능

- Android Chrome WebXR 바닥 인식
- 원하는 바닥 위치에 갯벌 배치
- 빛나는 조개 5개 터치 수집
- 꽃게 등 갯벌 생물 오답 선택 시 50점 감점
- 수집 애니메이션, 효과음, 진동
- 점수, 진행률, 수집 개수 표시
- 미션 완료 화면과 무안 갯벌 생태 정보
- WebXR 미지원 환경용 카메라 3D 체험 모드

## 로컬 실행

```powershell
python -m http.server 8080
```

PC에서는 `http://localhost:8080`으로 화면과 수집 게임을 확인할 수 있습니다.

## 휴대폰 실행

WebXR과 카메라 기능은 HTTPS가 필요합니다. GitHub Pages, Netlify 또는
Vercel에 이 폴더를 배포하고 발급된 HTTPS 주소를 Android Chrome에서
여세요. WebXR 지원 기기는 바닥 인식 AR로, 미지원 기기는 카메라 기반
3D 체험 모드로 자동 실행됩니다.

카카오톡 등 앱 내부 브라우저에서는 카메라 또는 WebXR 기능이 제한될 수
있으므로 Chrome에서 직접 여는 것을 권장합니다.
