# 실험 계획 — E1 파이프라인 재현 (Gemini)

> 작성: 2026-07-20  
> 목표: `sdn_intent-framework`의 E1 실험(qwen3:8b)을 `sdn-xai-pipeline`의 Gemini 기반 파서로 재현하고 결과를 비교한다.  
> 브랜치: `main`에서 별도 브랜치를 따서 진행 (예: `experiment/e1-gemini`)

---

## 1. 실험 목적

| 질문 | 내용 |
|---|---|
| **RQ1** | Gemini는 자연어 SDN 인텐트를 얼마나 정확하게 IntentIR로 변환하는가? |
| **RQ2** | Few-shot / Topology grounding이 Gemini에서도 동일한 개선 효과를 보이는가? |
| **RQ3** | qwen3:8b(E1 원본) 대비 Gemini의 성능 차이는 어느 정도인가? |

---

## 2. 기존 E1과의 차이점

### 2-1. 모델

| 항목 | E1 원본 | 이번 실험 |
|---|---|---|
| 모델 | `qwen3:8b` (Ollama, local) | Gemini (Google API) |
| 온도 | 0.2 | 0.2 (동일) |
| 컨텍스트 | 4096 tokens | Gemini 기본값 |
| 실행 방식 | Ollama `/api/chat` | `google-generativeai` SDK |

### 2-2. IR 스키마 차이

E1 원본(`sdn_intent-framework`)과 현재 파이프라인의 IR 스키마가 다르다.  
**데이터셋 변환이 필요하다.**

| E1 framework (`IntentRule`) | 파이프라인 (`IntentIR`) |
|---|---|
| `intent_type: "forwarding"` | (없음, action에 통합) |
| `action: "deny"` | `action: "block"` |
| `action: "allow"` | `action: "forward"` |
| `action: "prioritize"` | `action: "qos"` |
| `selector.source.ip` | `src_ip` |
| `selector.destination.ip` | `dst_ip` |
| `selector.protocol` | `ip_proto` |
| `selector.destination_port` | `dst_port` |
| `selector.ingress_port` | `in_port` |
| `selector.eth_type` | `eth_type` |
| `enforcement.device` | `device_hint` |
| `enforcement.egress_port` | `out_port` |
| `qos.queue` | `queue_id` |
| `status: "rejected"` + `rejection.reason` | `status: "rejected"` + `rejection_reason` |

### 2-3. src_ip 필수 여부 (중요)

현재 파이프라인 SYSTEM_PROMPT는 `forward`/`block` 시 `src_ip`와 `dst_ip` **둘 다 필수**로 요구한다. 하지만 E1 upstream 케이스(N001~N050)의 상당수가 `src_ip: null`이다.

**해결 방식**: 실험 전용 system prompt를 별도로 작성하여 src_ip 미필수 조건으로 완화한다.  
(현재 파이프라인의 프로덕션 프롬프트는 변경하지 않는다.)

---

## 3. 실험 설계

### 3-1. 트리트먼트

E1-A(direct ONOS)는 파이프라인 구조상 적합하지 않아 제외. **3개 트리트먼트** 실행.

| 트리트먼트 | Few-shot | Topology grounding | 비고 |
|---|---|---|---|
| **T-B** | ❌ | ❌ | zero-shot IR |
| **T-C** | ✅ | ❌ | few-shot IR (demonstrations.json 변환 사용) |
| **T-D** | ✅ | ✅ | few-shot + grounding (현재 파이프라인 기본값) |

### 3-2. 반복 횟수

- 5 repetition (seed 42~46 고정, 재현성 확보)
- 3 treatment × 5 repetition × 100 case = **1,500 calls**

### 3-3. 데이터셋

- 입력: `sdn_intent-framework/experiments/e1/data/intents.jsonl` (100개 instruction)
- Gold: 파이프라인 IR 스키마로 변환한 `intents_pipeline.jsonl`

---

## 4. 생성할 파일 구조

```
sdn-xai-pipeline/
└── experiments/
    └── e1/
        ├── data/
        │   ├── intents_pipeline.jsonl     # 변환된 gold 데이터셋
        │   ├── demonstrations_pipeline.json  # 변환된 few-shot 예시
        │   └── topology.json              # 기존 e1 topology 복사
        ├── convert_dataset.py             # [Step 1] E1 → 파이프라인 IR 변환기
        ├── run_experiment.py              # [Step 2] 실험 러너 (Gemini)
        ├── score.py                       # [Step 3] 채점기
        ├── logs/                          # 실험 결과 JSONL
        │   └── {treatment}-{run_id}-r{rep}.jsonl
        └── reports/                       # 집계 결과 JSON
            └── e1_pipeline_aggregate.json
```

---

## 5. 구현 단계

### Step 1 — 데이터셋 변환 (`convert_dataset.py`)

**입력**: `e1/data/intents.jsonl` (E1 framework 스키마)  
**출력**: `experiments/e1/data/intents_pipeline.jsonl` (파이프라인 스키마)

변환 규칙:

```python
# action 매핑
action_map = {
    "forward":    "forward",
    "deny":       "block",
    "allow":      "forward",   # security allow → forward
    "prioritize": "qos",
}

# 필드 매핑 (selector → 파이프라인 flat 필드)
rule["src_ip"]      = selector.source.ip      (+ "/32" if no mask)
rule["dst_ip"]      = selector.destination.ip
rule["ip_proto"]    = selector.protocol
rule["dst_port"]    = selector.destination_port
rule["src_port"]    = selector.source_port
rule["in_port"]     = selector.ingress_port
rule["eth_type"]    = selector.eth_type
rule["device_hint"] = enforcement.device      (ONOS ID 그대로)
rule["out_port"]    = enforcement.egress_port
rule["queue_id"]    = qos.queue

# rejection 매핑
rejection_reason_map = {
    "ambiguous":      "ambiguous",
    "contradictory":  "contradictory",
    "unknown_entity": "unknown_entity",
    "unsupported":    "unsupported",
}
```

**처리 예외 케이스:**
- `src_ip: null`인 forward/block → gold에 `src_ip: null`로 그대로 유지 (실험 프롬프트에서 허용)
- Compound 케이스(2개) → `CompoundIntentIR` 형식으로 변환
- `action: "allow"` (security) → 파이프라인에 allow 개념 없음 → `forward`로 매핑, 메타데이터에 원본 표기

### Step 2 — 실험 러너 (`run_experiment.py`)

Gemini API를 사용해 각 instruction을 파싱하고 결과를 저장한다.

**핵심 설계:**

```python
# 트리트먼트별 system prompt 조립
def build_system_prompt(treatment: str, topology: dict | None, demonstrations: list | None) -> str:
    base = SYSTEM_PROMPT_EXPERIMENT   # 실험 전용 (src_ip 미필수 완화 버전)
    if treatment in ("T-C", "T-D") and demonstrations:
        base += format_few_shot(demonstrations)
    if treatment == "T-D" and topology:
        base += format_topology(topology)
    return base

# PredictionRecord 형식 (e1_evaluation 호환)
record = {
    "case_id":      case["id"],
    "treatment":    treatment,       # "T-B" | "T-C" | "T-D"
    "run_id":       run_id,
    "repetition":   repetition,      # 1~5
    "output":       llm_output,      # 파싱된 dict
    "latency_ms":   latency,
    "input_tokens": input_tokens,
    "output_tokens": output_tokens,
    "seed":         seed,
    "raw_content":  raw_text,
    "error_kind":   None | "transport" | "schema_invalid",
    "error":        None | "ErrorType: message",
}
```

**Gemini 호출 방식:**

```python
import google.generativeai as genai

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel(
    model_name="gemini-3.1-flash-lite",   # 또는 다른 모델
    generation_config={"temperature": 0.2, "response_mime_type": "application/json"},
)

response = model.generate_content([
    {"role": "user", "parts": [system_prompt + "\n\n" + instruction]}
])
```

**재개(resume) 지원**: 이미 저장된 케이스는 건너뜀 (E1 원본 방식 동일)

### Step 3 — 채점기 (`score.py`)

파이프라인 IR 기준으로 slot 단위 비교.

**평가 지표:**

| 지표 | 설명 |
|---|---|
| `schema_validity` | LLM 출력이 파이프라인 IR 스키마를 준수하는 비율 |
| `exact_match` | gold IR과 전체 일치 비율 |
| `rule_count_accuracy` | 룰 개수 일치 비율 (compound 케이스 관련) |
| `slot_accuracy` | 필드별 정확도: action / src_ip / dst_ip / ip_proto / dst_port / device_hint / out_port / queue_id |
| `hallucination_rate` | 토폴로지 인벤토리에 없는 entity를 생성한 비율 |
| `rejection_recall` | 거부해야 할 케이스를 올바르게 거부한 비율 |
| `rejection_recall_by_reason` | ambiguous / contradictory / unknown_entity / unsupported별 recall |

**집계 방식**: 5 repetition → mean ± sample_sd, 95% bootstrap CI (10,000 samples)

---

## 6. 비교 분석 계획

### 6-1. Gemini vs qwen3:8b 비교

동일한 100 케이스, 동일한 트리트먼트(T-B/C/D)로 비교.  
단, IR 스키마가 다르므로 **직접 수치 비교는 상대적 개선 폭**으로만 한다.

| 비교 항목 | 기대 가설 |
|---|---|
| Schema validity | Gemini가 더 높을 것 (instruction following 우수) |
| Exact match | T-D에서 Gemini가 더 높을 것 |
| Hallucination | T-D에서 Gemini가 더 낮을 것 |
| Few-shot 효과 (B→C) | 비슷할 것 |
| Grounding 효과 (C→D) | 비슷할 것 (device slot 개선 집중 예상) |

### 6-2. Cohort별 분석

- **Upstream (N001~N050)**: task-equivalence confound 없음 → 모델 순수 성능 비교
- **Project-authored (P001~P050)**: compound/rejection 케이스 포함 → 완전성 비교

### 6-3. Slot-level 분해

E1 원본 결과와 같이 device 슬롯에서 grounding 효과가 집중되는지 확인한다.

---

## 7. 기술적 주의사항

### 7-1. Gemini API 비용 및 속도 제한

- 1,500 calls 기준 비용 추정 필요 (모델별 상이)
- Rate limit: `gemini-3.1-flash-lite` 기준 RPM 제한 확인 후 `time.sleep()` 조절
- 실험 중단 시 resume 기능으로 이어서 실행 가능

### 7-2. JSON 출력 안정성

- Gemini에 `response_mime_type: "application/json"` 설정으로 JSON 강제
- `response_schema` (JSON Schema)를 추가로 전달하면 구조 준수율 향상

### 7-3. src_ip null 케이스 처리

- 실험 프롬프트에서 `src_ip` 미필수 허용
- Gold에 `src_ip: null`인 케이스는 LLM 출력도 `null`이면 정답으로 처리
- 프로덕션 파이프라인의 strict 요구조건과 별개임을 코드 주석에 명시

### 7-4. "allow" action 매핑

- E1 framework의 `action: "allow"` (security-type)는 파이프라인에 없음
- Gold 변환 시 `forward`로 매핑
- 채점 시 LLM이 `forward`를 출력하면 정답으로 인정

---

## 8. 실험 실행 순서

```bash
# 0. 브랜치 생성
git checkout -b experiment/e1-gemini

# 1. 데이터셋 변환
python experiments/e1/convert_dataset.py \
  --input ../../sdn_intent-framework/experiments/e1/data/intents.jsonl \
  --output experiments/e1/data/intents_pipeline.jsonl

# 2. demonstrations 변환 (few-shot용)
python experiments/e1/convert_dataset.py \
  --input ../../sdn_intent-framework/experiments/e1/data/demonstrations.json \
  --mode demonstrations \
  --output experiments/e1/data/demonstrations_pipeline.json

# 3. 실험 실행 (treatment × repetition)
for treatment in T-B T-C T-D; do
  for rep in 1 2 3 4 5; do
    python experiments/e1/run_experiment.py \
      --treatment $treatment \
      --repetition $rep \
      --model gemini-3.1-flash-lite
  done
done

# 4. 채점
python experiments/e1/score.py \
  --dataset experiments/e1/data/intents_pipeline.jsonl \
  --output experiments/e1/reports/e1_pipeline_aggregate.json \
  experiments/e1/logs/*.jsonl
```

---

## 9. 결과 보고 형식

최종 결과는 E1 원본 `e1_results.md`와 같은 형식으로 작성한다.

```markdown
## Table X. Intent translation 성능 (Gemini, mean of 5 runs, 100-case 전체)

| Metric | T-B (zero-shot) | T-C (few-shot) | T-D (few-shot+grounding) |
|---|---:|---:|---:|
| Schema validity | ... | ... | ... |
| Exact match | ... | ... | ... |
| Rule-count accuracy | ... | ... | ... |
| Hallucination rate | ... | ... | ... |
| Rejection rate | ... | ... | ... |

## Table X+1. Gemini vs qwen3:8b 비교 (T-D 기준)

| Metric | qwen3:8b (E1-D) | Gemini (T-D) |
|---|---:|---:|
| Exact match | 0.368 | ? |
| Hallucination rate | 0.021 | ? |
```

---

## 10. 체크리스트

- [ ] `experiment/e1-gemini` 브랜치 생성
- [ ] `experiments/e1/` 디렉토리 구조 생성
- [ ] `convert_dataset.py` 작성 및 테스트 (100개 변환 검증)
- [ ] `demonstrations_pipeline.json` 변환 (5개 예시 검증)
- [ ] `topology.json` 복사
- [ ] 실험 전용 SYSTEM_PROMPT 작성 (src_ip 완화)
- [ ] `run_experiment.py` 작성 (Gemini SDK, resume 지원)
- [ ] T-B × 5 rep 실행
- [ ] T-C × 5 rep 실행
- [ ] T-D × 5 rep 실행
- [ ] `score.py` 작성 및 채점
- [ ] 결과 분석 및 `e1_pipeline_results.md` 작성
- [ ] qwen3:8b 결과와 비교 섹션 추가
