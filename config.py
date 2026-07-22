"""
config.py — End-to-End XAI SDN 파이프라인 전역 설정

모든 모듈은 이 파일에서 설정을 임포트한다.
.env 파일 탐색 순서:
  1. BASE_DIR/.env  (레포 루트, GitHub clone 후 기본 위치)
  2. BASE_DIR/../.env  (상위 디렉토리, 모노레포 구조)
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# ── 경로 설정 ─────────────────────────────────────────────────
BASE_DIR: Path = Path(__file__).resolve().parent
ROOT_DIR: Path = BASE_DIR.parent

# .env 탐색: 레포 루트 우선, 없으면 상위 디렉토리
_env_local = BASE_DIR / ".env"
_env_parent = ROOT_DIR / ".env"
load_dotenv(_env_local if _env_local.exists() else _env_parent)

# ── LLM 설정 ─────────────────────────────────────────────────
LLM_BASE_URL: str = os.environ.get("LLM_BASE_URL", "https://ollama.jangmyun.dev/v1")
LLM_MODEL: str = os.environ.get("LLM_MODEL", "gemini-3.1-flash-lite")
EMBED_MODEL: str = os.environ.get("EMBED_MODEL", "nomic-embed-text")
LLM_API_KEY: str = os.environ.get("LLM_API_KEY", "ollama")
GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")

# ── ONOS 설정 ─────────────────────────────────────────────────
ONOS_URL: str = os.environ.get("ONOS_URL", "http://127.0.0.1:8181/onos/v1")
ONOS_USER: str = os.environ.get("ONOS_USER", "onos")
ONOS_PASSWORD: str = os.environ.get("ONOS_PASSWORD", "rocks")

# ── API 서버 설정 ─────────────────────────────────────────────
# CORS_ORIGINS: 쉼표 구분 허용 출처. 기본값 "*" (개발용).
# 운영 배포 시 .env에서 "https://your-domain.com" 등으로 지정할 것.
CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "*").split(",")
    if o.strip()
] or ["*"]

# API_KEY: X-API-Key 헤더 인증. 빈 문자열이면 인증 비활성화 (개발용).
# 운영 배포 시 .env에서 강력한 랜덤 키로 반드시 설정할 것.
API_KEY: str = os.environ.get("API_KEY", "")

# ── 로컬 디렉토리 ─────────────────────────────────────────────
LOGS_DIR: Path = BASE_DIR / "logs"
RESULTS_DIR: Path = BASE_DIR / "results"
DATA_DIR: Path = BASE_DIR / "data"

LOGS_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── 데이터셋 경로 ─────────────────────────────────────────────
# 외부 실험 데이터셋(우선) → 로컬 data/ 폴백
_external_dataset: Path = (
    ROOT_DIR
    / "experiments"
    / "1_netintent_baseline"
    / "NetIntent"
    / "GitHub NetIntent"
    / "Datasets"
    / "Intent2Flow-ONOS.csv"
)
DATASET_PATH: Path = (
    _external_dataset
    if _external_dataset.exists()
    else BASE_DIR / "data" / "intents_v2.jsonl"
)


def is_gemini(model: str) -> bool:
    """Gemini 모델 여부 판단"""
    return model.lower().startswith("gemini")


def validate_config() -> list[str]:
    """
    설정 유효성 검사. 경고 메시지 목록을 반환한다.
    서버/CLI 시작 시 호출하여 문제를 조기에 알린다.
    """
    warnings: list[str] = []

    if ONOS_PASSWORD == "rocks":
        warnings.append(
            "ONOS_PASSWORD가 기본값 'rocks'입니다. 운영 환경에서는 반드시 변경하세요."
        )

    if not API_KEY:
        warnings.append(
            "API_KEY가 설정되지 않았습니다. /api/run 엔드포인트에 인증이 없습니다. "
            "운영 배포 시 .env에서 API_KEY를 설정하세요."
        )

    if CORS_ORIGINS == ["*"]:
        warnings.append(
            "CORS_ORIGINS='*' — 모든 출처의 요청을 허용합니다. "
            "운영 배포 시 .env에서 CORS_ORIGINS를 명시적으로 지정하세요."
        )

    return warnings
