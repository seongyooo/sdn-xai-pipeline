# SDN XAI Pipeline

자연어 네트워크 인텐트를 ONOS FlowRule로 안전하게 변환하는 End-to-End 파이프라인.
LLM/RAG 기반 인텐트 해석부터 정적 검증, Digital Twin 시뮬레이션, XAI 설명, ONOS 배포까지 6단계로 처리한다.


---

## 파이프라인 구조

```
자연어 인텐트
     │
     ▼
[Stage 1] LLM/RAG → Intent IR          (자연어 파싱 + 환각 억제)
     │
     ▼
[Stage 2] Deterministic Compiler        (IntentIR → ONOS FlowRule JSON)
     │
     ▼
[Stage 3] Static Validator              (스키마 검증 + 충돌 탐지 5종)
     │ FAIL ──────────────────────────┐
     │ PASS                           │
     ▼                                │
[Stage 4] Digital Twin 검증            │  (Mininet+ONOS 임시 배포 → rollback)
     │ FAIL ──────────────────────────┤
     │ PASS                           │
     ▼                                │
[Stage 5] XAI 설명 생성               │
     │                                │
     ▼                                ▼
[Stage 6] ONOS 배포              REJECT / 운영자 확인
```

---

## 주요 기여

| 기여 | 설명 | 구현 위치 |
|------|------|-----------|
| **Intent IR** | LLM과 컨트롤러를 분리하는 중간 표현 — 재현성 보장 | `models/intent_ir.py` |
| **결정론적 컴파일러** | 동일 IR → 항상 동일 FlowRule, LLM 환각 원천 차단 | `stage2_flowrule/compiler.py` |
| **정적 검증** | Shadowing·Redundancy 등 5종 충돌을 LLM 없이 탐지 | `stage3_static/` |
| **Digital Twin 루프** | 임시 배포 → 검증 → rollback으로 안전성 확인 | `stage4_twin/` |
| **Evidence-grounded XAI** | 설명 근거를 실제 stage 출력 데이터에 연결 | `stage5_xai/explainer.py` |

---

## 디렉토리 구조

```
sdn-xai-pipeline/
├── main.py                  # 메인 CLI 진입점
├── api.py                   # FastAPI 서버 (REST API + Web UI 서빙)
├── config.py                # 전역 설정 (.env 로드)
├── evaluate.py              # 파이프라인 평가 스크립트
├── models/
│   ├── intent_ir.py         # IntentIR 데이터 모델 (Pydantic)
│   └── topology.py          # 네트워크 토폴로지 + 엔티티 검증
├── pipeline/
│   ├── stage1_intent/
│   │   ├── llm_client.py    # LLM 백엔드 추상화 (Ollama / Gemini)
│   │   ├── rag.py           # FAISS 기반 RAG 인덱스
│   │   └── intent_parser.py # 자연어 → IntentIR
│   ├── stage2_flowrule/
│   │   └── compiler.py      # IntentIR → ONOS FlowRule
│   ├── stage3_static/
│   │   ├── schema_validator.py  # Pydantic 스키마 검증
│   │   ├── conflict_detector.py # Rule-based 충돌 탐지
│   │   └── static_validator.py  # 통합 인터페이스
│   ├── stage4_twin/
│   │   ├── onos_client.py   # ONOS REST API 클라이언트
│   │   ├── topology.py      # Mininet 다이아몬드 토폴로지
│   │   └── twin_verifier.py # Twin 검증 + rollback
│   ├── stage5_xai/
│   │   └── explainer.py     # XAI 보고서 생성
│   └── stage6_deploy/
│       └── deployer.py      # 실제 ONOS 배포
├── data/
│   ├── custom_topology.json # 커스텀 토폴로지 정의
│   └── intents_v2.jsonl     # 학습/평가용 인텐트 데이터셋
├── scripts/
│   ├── generate_dataset.py  # 인텐트 데이터셋 생성
│   └── validate_dataset.py  # 데이터셋 구조 검증
├── docs/                    # 설계 문서 및 논문 자료
└── logs/                    # 실행 결과 JSON (run_id 기반, .gitignore)
```

---

## WSL 실행 가이드

### 1. 클론 및 의존성 설치

```bash
git clone https://github.com/seongyooo/sdn-xai-pipeline.git
cd sdn-xai-pipeline
pip install -r requirements.txt
```

Digital Twin(Mininet) 사용 시 추가 설치:

```bash
sudo apt update && sudo apt install -y mininet
```

### 2. 환경변수 설정

프로젝트 루트에 `.env` 파일 생성:

```bash
cat > .env << 'EOF'
LLM_BASE_URL=https://ollama.example.com/v1
LLM_MODEL=qwen3:8b
EMBED_MODEL=nomic-embed-text
LLM_API_KEY=ollama

GOOGLE_API_KEY=your_key_here

ONOS_URL=http://127.0.0.1:8181/onos/v1
ONOS_USER=onos
ONOS_PASSWORD=rocks
EOF
```

### 3. sudo 권한 설정 (Digital Twin 필수)

Mininet은 root 권한이 필요합니다. 매번 비밀번호 입력 없이 실행하려면:

```bash
# sudoers 설정 (현재 사용자에게 NOPASSWD 부여)
echo "$USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/$USER
sudo chmod 440 /etc/sudoers.d/$USER
```

설정 확인:

```bash
sudo echo "sudo 권한 OK"
```

### 4. 앱 실행

#### Web UI (HTML/JS + FastAPI)

```bash
# 일반 실행 (Digital Twin 스킵)
uvicorn api:app --reload --port 8000

# Digital Twin 사용 시 (root 필요)
sudo -E $(which uvicorn) api:app --port 8000
```

브라우저에서 `http://localhost:8000` 접속

#### CLI

```bash
python pipeline.py --intent "block all traffic from 10.0.0.1 to 10.0.0.4 on switch 1"
```

---

## 사용법 (CLI 옵션)

```bash
# 기본 실행
python main.py --intent "block all traffic from 10.0.0.1 to 10.0.0.4 on switch 1"

# Gemini 모델 사용, Digital Twin 스킵
python main.py --intent "..." --model gemini-2.0-flash --skip-twin

# RAG 예시 수 조정, 상세 출력
python main.py --intent "..." --rag-k 5 --verbose

# 배포까지 스킵 (검증만 수행)
python main.py --intent "..." --skip-twin --skip-deploy

# RAG 없이 LLM 직접 호출
python main.py --intent "..." --no-rag
```

**종료 코드**
| 코드 | 의미 |
|------|------|
| `0` | APPROVE (모든 검증 통과, 배포 완료) |
| `1` | APPROVE_WITHOUT_TWIN (Twin 스킵, 배포 완료) |
| `2` | REJECT (검증 실패 또는 인텐트 거부) |
| `3` | ERROR (파이프라인이 예외로 중단됨 — 승인/거부 판정에 도달하지 못함) |
| `4` | DEPLOY_FAILED (승인 판정까지는 통과했으나 ONOS 배포가 실패함) |

---

## 인텐트 예시

```
# 트래픽 차단
block all traffic from 10.0.0.1 to 10.0.0.4 on switch 1

# 포워딩
forward traffic from 10.0.0.1 to 10.0.0.2 via switch 2

# QoS
prioritize TCP traffic from 10.0.0.1 to 10.0.0.3 on switch 1

# 서비스 체인 (방화벽 경유)
route traffic from h1 to h4 through firewall on switch 1

# 경로 변경
reroute traffic from 10.0.0.1 to 10.0.0.2 via switch 3
```

---

## XAI 출력 예시

```
인텐트: block all traffic from 10.0.0.1 to 10.0.0.4 on switch 1

[인텐트 해석]  action=block(차단) | device=1 | src=10.0.0.1/32 | dst=10.0.0.4/32
[FlowRule]    deviceId=of:0000000000000001 | priority=40000 | criteria=3개 | action=DROP
[정적 검증]   PASS (스키마 OK, 충돌 없음)
[Digital Twin] 검증 통과 (3/3 체크)

최종 결정: APPROVE
판정 근거: 정적 검증 통과 (스키마 OK, 충돌 없음); Digital Twin 검증 통과 (3/3 체크)
```

---

## 환경

- **LLM**: Ollama (qwen3:8b 기본) / Google Gemini API
- **임베딩**: nomic-embed-text (RAG용)
- **벡터 검색**: FAISS (IndexFlatL2)
- **SDN 컨트롤러**: ONOS 2.7 (Docker)
- **Digital Twin**: Mininet 다이아몬드 토폴로지 (s1–s4, h1–h4)
- **UI**: HTML/JS (FastAPI static 서빙)
