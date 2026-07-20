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
LLM_MODEL: str = os.environ.get("LLM_MODEL", "qwen3:8b")
EMBED_MODEL: str = os.environ.get("EMBED_MODEL", "nomic-embed-text")
LLM_API_KEY: str = os.environ.get("LLM_API_KEY", "ollama")
GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")

# ── ONOS 설정 ─────────────────────────────────────────────────
ONOS_URL: str = os.environ.get("ONOS_URL", "http://127.0.0.1:8181/onos/v1")
ONOS_USER: str = os.environ.get("ONOS_USER", "onos")
ONOS_PASSWORD: str = os.environ.get("ONOS_PASSWORD", "rocks")

# ── 로컬 디렉토리 ─────────────────────────────────────────────
LOGS_DIR: Path = BASE_DIR / "logs"
RESULTS_DIR: Path = BASE_DIR / "results"
DATA_DIR: Path = BASE_DIR / "data"

LOGS_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── 데이터셋 경로 ─────────────────────────────────────────────
DATASET_PATH: Path = (
    ROOT_DIR
    / "experiments"
    / "1_netintent_baseline"
    / "NetIntent"
    / "GitHub NetIntent"
    / "Datasets"
    / "Intent2Flow-ONOS.csv"
)


def is_gemini(model: str) -> bool:
    """Gemini 모델 여부 판단"""
    return model.lower().startswith("gemini")
