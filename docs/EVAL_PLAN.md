# 정량 평가 프레임워크 계획

> 작성: 2026-07-20  
> 참조: `sdn_intent-framework/experiments/e1` 설계 기반  
> 목적: Stage 1 인텐트 파싱 정확도 및 전 파이프라인 성능을 정량적으로 측정한다.

---

## 1. 개요

### 1-1. 평가 목표

파이프라인의 각 구성 요소가 기여하는 성능 향상을 수치로 측정한다.

| 평가 대상 | 측정 항목 |
|---|---|
| Stage 1 인텐트 파싱 | IR 슬롯 정확도, 환각률, Rejection Recall |
| Stage 1 구성 요소별 기여 | RAG / 토폴로지 그라운딩 / Repair 루프 효과 |
| Stage 2 컴파일러 | 파싱 성공 → FlowRule 변환 성공률 |
| 전체 파이프라인 | APPROVE 판정 정확도 (Stage 3~5 포함) |

### 1-2. E1과의 대응 관계

E1은 **출력 형식(ONOS JSON vs IR)**의 차이를 비교한다.  
본 평가는 파이프라인이 IR 형식을 고정하고 **입력 구성(RAG / Grounding / Repair)**의 차이를 비교한다.

| E1 Treatment | 대응 의미 | 본 평가 Treatment |
|---|---|---|
| E1-A (ONOS 직접 출력) | 컴파일러 없이 LLM이 FlowRule 생성 | — (별도 실험으로 추후 추가 가능) |
| E1-B (IR, Zero-Shot) | RAG 없음, Grounding 없음 | **T-A** |
| E1-C (IR, Few-Shot) | RAG 있음, Grounding 없음 | **T-B** |
| E1-D (IR, Few-Shot + Grounding) | RAG 있음, Grounding 있음 | **T-C** |
| — | RAG + Grounding + Repair 루프 | **T-D** (추후 Repair 구현 후 추가) |

---

## 2. 데이터셋

### 2-1. 현황

`data/intents_v2.jsonl` — 100개 케이스

| 카테고리 | 케이스 수 | 비고 |
|---|---|---|
| forwarding | 15 | 단일 룰 |
| security (block) | 15 | 단일 룰 |
| qos | 10 | 단일 룰 |
| sfc | 25 | 복합 룰 (모두 multi-rule) |
| reroute | 25 | 단일 룰 |
| ambiguous_unsupported | 10 | rejected 케이스 |
| **합계** | **100** | accepted 90 / rejected 10 |

Rejection 분포 (10개):

| rejection_reason | 수 |
|---|---|
| ambiguous | 3 |
| contradictory | 2 |
| unknown_entity | 3 |
| unsupported | 2 |

### 2-2. Gold 스키마와 파이프라인 IR의 차이

`intents_v2.jsonl`의 gold program은 `sdn_intent-framework` 스키마를 따르고,  
파이프라인은 자체 `IntentIR` 스키마를 사용한다. 평가 시 **정규화(normalization) 레이어**가 필요하다.

| gold (intents_v2) | pipeline IntentIR | 정규화 규칙 |
|---|---|---|
| `action: "forward"` | `action: "forward"` | 동일 |
| `action: "deny"` | `action: "block"` | `deny` → `block` 매핑 |
| `action: "allow"` | `action: "forward"` | `allow` → `forward` 매핑 |
| `action: "prioritize"` | `action: "qos"` | `prioritize` → `qos` 매핑 |
| `selector.source.host` | `selector.source.host` | 동일 |
| `selector.source.ip` | `selector.source.ip` | 대소문자 무시, /32 정규화 |
| `selector.destination_port` | `selector.dst_port` | 키 이름 다름 |
| `enforcement.egress_port` | `enforcement.egress_port` | int/str 정규화 |
| `enforcement.device` (ONOS ID) | `enforcement.device` (자연어 or ONOS ID) | 토폴로지 alias 해석 후 비교 |

### 2-3. 데이터셋 개선 계획

현재 데이터셋의 한계:
- compound 케이스 25개가 모두 sfc 카테고리 — forward+block 복합 인텐트 케이스 부재
- rejected 케이스 10개 — `contradictory` 케이스 2개뿐 (부족)

추가할 케이스:
| 유형 | 추가 수 | 예시 |
|---|---|---|
| compound (forward+block) | 5 | "Allow HTTP from h1 to h2, but block SSH" |
| compound (block+qos) | 5 | "Block ICMP from h1, apply QoS for video from h2" |
| contradictory | 3 | "Allow and block h1→h2 TCP 80 on switch 1" |
| unknown_entity | 2 | "Route h9 traffic to h4" |

→ **목표: 115케이스 (accepted 100 / rejected 15)**

---

## 3. Treatments (실험 조건)

### T-A: Baseline (RAG ❌ / Grounding ❌)

- RAG 인덱스 비활성화 (`no_rag=True`)
- 토폴로지를 시스템 프롬프트에 주입하지 않음
- LLM이 시스템 프롬프트와 인텐트만 보고 IR 생성

### T-B: RAG Only (RAG ✅ / Grounding ❌)

- FAISS 인덱스에서 유사 예시 k=3 검색 후 few-shot 삽입
- 토폴로지 주입 없음

### T-C: Grounding Only (RAG ❌ / Grounding ✅)

- 토폴로지 컨텍스트를 시스템 프롬프트 앞에 삽입
  ```
  ## Network Topology
  Hosts: h1 (10.0.0.1), h2 (10.0.0.2), h3 (10.0.0.3), h4 (10.0.0.4)
  Switches: s1 (of:0000000000000001) ports [1,2,3,4,9], ...
  ```
- RAG 없음

### T-D: RAG + Grounding (RAG ✅ / Grounding ✅) — 현재 기본값

- T-B + T-C 결합 — 현재 파이프라인 기본 설정

### T-E: RAG + Grounding + Repair (RAG ✅ / Grounding ✅ / Repair ✅) — 추후 추가

- T-D에 Repair 루프 추가
- Stage 3 실패 → 오류 피드백 포함 재파싱 (최대 3회)
- Repair 루프 구현 후 활성화

---

## 4. 평가 지표

### 4-1. Stage 1 전용 지표

#### `schema_validity`
LLM 출력이 IntentIR로 파싱 성공한 비율.

```
schema_validity = 파싱 성공 케이스 수 / 전체 케이스 수
```

파싱 실패 원인:
- JSON 파싱 오류 (LLM이 valid JSON을 반환하지 않음)
- 필수 필드 누락 (`action` 없음 등)
- 유효하지 않은 IP 형식

#### `normalized_exact_match`
gold program과 예측 IR이 슬롯 단위로 완전히 일치하는 비율.

```
exact_match = 완전 일치 케이스 수 / 전체 케이스 수
```

정규화 규칙:
- action 매핑 적용 (deny→block, allow→forward, prioritize→qos)
- IP 주소: 소문자, /32 suffix 정규화
- device: 토폴로지 alias 해석 후 ONOS device_id로 통일
- port: int 변환 후 비교
- status 불일치 → 자동 실패 (accepted ≠ rejected)

#### `slot_accuracy`
슬롯별 독립적인 정확도 (partially correct credit).

추적 슬롯:

| 슬롯 | 필드 경로 | 비교 방식 |
|---|---|---|
| `action` | `rules[*].action` | alias 매핑 후 exact |
| `source_host` | `rules[*].selector.source.host` | case-insensitive |
| `source_ip` | `rules[*].selector.source.ip` | IP 정규화 후 exact |
| `destination_host` | `rules[*].selector.destination.host` | case-insensitive |
| `destination_ip` | `rules[*].selector.destination.ip` | IP 정규화 후 exact |
| `protocol` | `rules[*].selector.protocol` | exact |
| `dst_port` | `rules[*].selector.dst_port` | int 정규화 |
| `device` | `rules[*].enforcement.device` | alias 해석 후 exact |
| `egress_port` | `rules[*].enforcement.egress_port` | int 정규화 |
| `alt_egress_port` | `rules[*].enforcement.alt_egress_port` | int 정규화 |
| `queue` | `rules[*].qos.queue` | int 정규화 |
| `via_device` | `rules[*].routing.via_device` | alias 해석 |
| `avoid_device` | `rules[*].routing.avoid_device` | alias 해석 |
| `waypoints` | `rules[*].routing.waypoints` | list 순서 무관 비교 |

각 슬롯 accuracy:
```
slot_accuracy[slot] = Σ(correct matches for slot across all rules) / Σ(expected rule count)
```

#### `rule_count_accuracy`
복합 인텐트에서 예측한 rule 개수가 gold와 일치하는 비율.

```
rule_count_accuracy = 개수 일치 케이스 수 / accepted 케이스 수
```

#### `hallucinated_entity_rate`
예측 IR에 등장하는 엔티티 중 토폴로지 인벤토리에 없는 비율.

검사 대상 엔티티: source.host, destination.host, source.ip, destination.ip, enforcement.device

```
hallucination_rate = 환각 엔티티 수 / 전체 예측 엔티티 수
```

환각 기준: 토폴로지 `aliases` dict에 없는 값 (정규화 후에도 매핑 불가).

#### `rejection_recall` (전체 및 reason별)
거부해야 할 케이스를 올바르게 거부한 비율.

```
rejection_recall = 올바르게 rejected 케이스 / 전체 expected-rejected 케이스

rejection_recall_by_reason = {
  "ambiguous":      N_correct / N_expected,
  "contradictory":  N_correct / N_expected,
  "unknown_entity": N_correct / N_expected,
  "unsupported":    N_correct / N_expected,
}
```

#### `false_rejection_rate`
accepted여야 할 케이스를 잘못 거부한 비율.

```
false_rejection_rate = 잘못 rejected 케이스 / 전체 expected-accepted 케이스
```

### 4-2. 전체 파이프라인 지표 (선택적)

파싱 성공 케이스에 대해 Stage 2~5까지 실행:

| 지표 | 측정 방법 |
|---|---|
| `compile_success_rate` | 파싱 성공 케이스 중 FlowRule 컴파일 성공 비율 |
| `static_pass_rate` | 컴파일 성공 케이스 중 Stage 3 PASS 비율 |
| `end_to_end_approve_rate` | APPROVE 판정 비율 (파이프라인 전체 통과) |

---

## 5. 실험 실행 설계

### 5-1. 반복 횟수 및 시드

- 반복(repetition): **5회** (E1과 동일)
- 시드: repetition N → seed = 41 + N (1→42, 2→43, ..., 5→46)
- LLM temperature: 0.0 (결정론적 출력, 단 Gemini API 지원 시)
- LLM 미지원 시: 5회 독립 실행 결과 분산으로 변동성 측정

### 5-2. 출력 파일 구조

```
experiments/
  eval/
    data/
      intents_v2.jsonl          # 평가 데이터셋 (기존)
      topology_eval.json         # 평가용 토폴로지 alias 인벤토리
    logs/
      eval-T-A-r1-<uuid>.jsonl   # 예측 레코드 (treatment|repetition)
      eval-T-B-r1-<uuid>.jsonl
      ...
    reports/
      report_T-A.json            # treatment별 집계 결과
      report_T-B.json
      summary_all.json           # 전체 비교표
    run_eval.py                  # 실행 스크립트
    score_eval.py                # 채점 스크립트
    config/
      T-A.toml
      T-B.toml
      T-C.toml
      T-D.toml
```

### 5-3. 예측 레코드 형식 (JSONL)

```json
{
  "case_id": "F01",
  "treatment": "T-C",
  "run_id": "eval-T-C-gemini-flash-<uuid>",
  "repetition": 1,
  "seed": 42,
  "output": {
    "status": "accepted",
    "program": { "rules": [...] }
  },
  "raw_content": "...",
  "latency_ms": 1234.5,
  "input_tokens": 800,
  "output_tokens": 120,
  "error_kind": null,
  "error": null
}
```

`error_kind` 값:
- `null` — 정상
- `"transport"` — API 연결 오류
- `"schema_invalid"` — JSON/파싱 실패
- `"timeout"` — API 응답 초과

### 5-4. 집계 결과 형식

```json
{
  "gold_status": "provisional_gold",
  "treatment": "T-C",
  "model": "gemini-2.0-flash",
  "n_repetitions": 5,
  "metrics": {
    "schema_validity":       { "runs": [...], "mean": 0.94, "sample_sd": 0.02, "min": 0.91, "max": 0.96 },
    "normalized_exact_match":{ "runs": [...], "mean": 0.82, "sample_sd": 0.03, "min": 0.79, "max": 0.85 },
    "rule_count_accuracy":   { "runs": [...], "mean": 0.89, "sample_sd": 0.02 },
    "hallucinated_entity_rate":{ "runs": [...], "mean": 0.03, "sample_sd": 0.01 },
    "rejection_recall":      { "runs": [...], "mean": 0.80, "sample_sd": 0.05 },
    "false_rejection_rate":  { "runs": [...], "mean": 0.02, "sample_sd": 0.01 }
  },
  "slot_accuracy": {
    "action":           { "mean": 0.95, "sample_sd": 0.01 },
    "source_ip":        { "mean": 0.92, "sample_sd": 0.02 },
    "destination_ip":   { "mean": 0.93, "sample_sd": 0.02 },
    "protocol":         { "mean": 0.88, "sample_sd": 0.03 },
    "dst_port":         { "mean": 0.85, "sample_sd": 0.03 },
    "device":           { "mean": 0.79, "sample_sd": 0.04 },
    "egress_port":      { "mean": 0.76, "sample_sd": 0.05 }
  },
  "rejection_recall_by_reason": {
    "ambiguous":      { "mean": 0.80, "sample_sd": 0.10 },
    "contradictory":  { "mean": 0.60, "sample_sd": 0.15 },
    "unknown_entity": { "mean": 0.90, "sample_sd": 0.07 },
    "unsupported":    { "mean": 0.70, "sample_sd": 0.12 }
  },
  "caveat": "n=5 반복 기준. 탐색적 결과이며 강한 통계적 추론에 사용하지 말 것."
}
```

---

## 6. 토폴로지 인벤토리 (`topology_eval.json`)

평가용 alias 해석 테이블. 현재 커스텀 토폴로지 기준:

```json
{
  "entities": [
    {"id": "host:h1", "aliases": ["h1", "10.0.0.1", "10.0.0.1/32"]},
    {"id": "host:h2", "aliases": ["h2", "10.0.0.2", "10.0.0.2/32"]},
    {"id": "host:h3", "aliases": ["h3", "10.0.0.3", "10.0.0.3/32"]},
    {"id": "host:h4", "aliases": ["h4", "10.0.0.4", "10.0.0.4/32"]},
    {"id": "device:s1", "aliases": ["s1", "switch 1", "switch1", "of:0000000000000001"]},
    {"id": "device:s2", "aliases": ["s2", "switch 2", "switch2", "of:0000000000000002"]},
    {"id": "device:s3", "aliases": ["s3", "switch 3", "switch3", "of:0000000000000003"]},
    {"id": "device:s4", "aliases": ["s4", "switch 4", "switch4", "of:0000000000000004"]}
  ],
  "ports": {
    "of:0000000000000001": [1, 2, 3, 4, 9],
    "of:0000000000000002": [1, 2, 3, 4],
    "of:0000000000000003": [1, 2, 3, 4],
    "of:0000000000000004": [1, 2, 3, 4]
  }
}
```

커스텀 토폴로지 사용 시 aliases를 동적으로 확장한다 (`data/custom_topology.json` 참조).

---

## 7. 구현 계획

### Phase 1 — 채점 엔진 (`score_eval.py`)

우선 실행 스크립트 없이도 기존 파이프라인 실행 결과를 채점할 수 있는 채점 모듈 구현.

```python
# 핵심 함수
def normalize_action(action: str) -> str:
    """deny→block, allow→forward, prioritize→qos"""

def resolve_entity(val: str, aliases: dict) -> str | None:
    """alias dict에서 엔티티 canonical ID 반환"""

def compare_slot(gold_val, pred_val, slot_name: str, aliases: dict) -> bool:
    """슬롯별 비교 (정규화 포함)"""

def score_case(gold: dict, pred: dict, aliases: dict) -> CaseResult:
    """케이스 단위 채점 → CaseResult"""

def aggregate_runs(case_results: list[list[CaseResult]]) -> TreatmentSummary:
    """5회 반복 집계 → mean, sd, bootstrap CI"""
```

### Phase 2 — 실행 스크립트 (`run_eval.py`)

파이프라인 Stage 1을 배치 실행하는 스크립트.

```bash
python experiments/eval/run_eval.py \
  --treatment T-C \
  --dataset data/intents_v2.jsonl \
  --topology experiments/eval/data/topology_eval.json \
  --model gemini-2.0-flash \
  --repetition 1 \
  --output experiments/eval/logs/
```

내부 동작:
1. `data/intents_v2.jsonl` 로드
2. Treatment 설정에 따라 `IntentParser` 초기화 (RAG/Grounding 토글)
3. 케이스별 `parser.parse(instruction)` 호출
4. 결과를 예측 레코드 JSONL로 저장

### Phase 3 — 리포트 생성 (`report_eval.py`)

여러 treatment의 예측 결과를 비교 리포트로 출력.

```bash
python experiments/eval/report_eval.py \
  --dataset data/intents_v2.jsonl \
  --topology experiments/eval/data/topology_eval.json \
  --logs experiments/eval/logs/ \
  --output experiments/eval/reports/summary_all.json
```

출력:
- JSON 리포트 (상세 수치)
- 콘솔 비교표 (논문 Table 형식)

```
Treatment | Schema | ExactMatch | SlotAcc | HallucinRate | RejRecall
----------|--------|------------|---------|--------------|----------
T-A       | 0.88   | 0.71       | 0.79    | 0.09         | 0.60
T-B       | 0.92   | 0.78       | 0.85    | 0.05         | 0.70
T-C       | 0.93   | 0.82       | 0.88    | 0.03         | 0.80
T-D       | 0.95   | 0.86       | 0.91    | 0.01         | 0.85
```

---

## 8. 예상 가설

E1 실험 결과를 참조해 본 파이프라인에서 예상되는 패턴:

| 지표 | T-A | T-B (+RAG) | T-C (+Grounding) | T-D (+Both) |
|---|---|---|---|---|
| schema_validity | ~0.85 | ~0.90 | ~0.88 | ~0.95 |
| exact_match | ~0.65 | ~0.75 | ~0.80 | ~0.85 |
| hallucination_rate | ~0.10 | ~0.06 | ~0.02 | ~0.01 |
| rejection_recall | ~0.50 | ~0.60 | ~0.75 | ~0.80 |
| device_slot_accuracy | ~0.60 | ~0.70 | ~0.85 | ~0.88 |

E1에서 Grounding의 효과가 RAG보다 컸음 (hallucination: 0.241 → 0.021). 본 파이프라인에서도 유사한 패턴 예상.

---

## 9. 구현 우선순위

| 단계 | 작업 | 난이도 | 예상 소요 |
|---|---|---|---|
| 1 | `topology_eval.json` 작성 | 낮음 | 1시간 |
| 2 | `score_eval.py` 채점 엔진 | 중 | 2~3시간 |
| 3 | `run_eval.py` 배치 실행 | 중 | 2~3시간 |
| 4 | 데이터셋 보강 (compound/rejection 추가) | 중 | 2~3시간 |
| 5 | 5회 × 4 treatment 실행 | 낮음 (실행 시간) | API 비용/시간 문제 |
| 6 | `report_eval.py` 리포트 생성 | 낮음 | 1시간 |
| 7 | T-E (Repair 루프) 추가 | 높음 | Repair 루프 구현 후 |

---

## 10. 주의사항

- **Gold 상태**: `intents_v2.jsonl`은 `provisional_gold` — 독립 이중 annotation 없이 작성된 파이프라인 픽스처. 논문 게재 전 독립 annotator 2인 검증 필요.
- **LLM 비결정성**: temperature=0이어도 Gemini API는 완전 결정론적 출력을 보장하지 않음. 5회 반복의 분산이 측정값의 신뢰 구간 역할을 함.
- **Bootstrap CI**: E1과 동일하게 n=5 기준 bootstrap CI (seed=42, 10,000 resamples)를 계산하되, 탐색적 참고값으로만 사용.
- **카테고리별 분석**: sfc/reroute는 gold enforcement 필드가 많아 slot_accuracy에서 이 카테고리 점수가 전체를 끌어내릴 수 있음. 카테고리별 분리 리포트 병행 필요.
