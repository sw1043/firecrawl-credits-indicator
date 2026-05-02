# Firecrawl: Fireworks AI Credits Monitor for VSCode

VSCode Status Bar에 Fireworks AI의 크레딧을 실시간으로 표시하는 확장 프로그램입니다.

## Requirements

- Python (`python` 또는 `python3` 명령어 사용 가능)
- `firectl` CLI가 설치되어 있고 `PATH`에 등록되어 있어야 합니다.
- `firectl signin`으로 인증이 완료되어 있어야 합니다.

## Features

- Status Bar 우측에 현재 Fireworks AI 크레딧 잔액 표시
- 60초마다 자동 갱신
- 수동 새로고침 (Status Bar 클릭)
- 미인증 상태에서 `firectl signin` 터미널 열기
- 크레딧 5달러 이하 시 경고 색상 및 알림

## Configuration

확장 프로그램 설정은 `firecrawl.yml` 파일로 관리됩니다.

