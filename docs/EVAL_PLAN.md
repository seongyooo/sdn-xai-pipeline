# 정량 평가 프레임워크 계획

> 작성: 2026-07-20  
> 참조: `sdn_intent-framework/experiments/e1` 설계 구조를 직접 계승  
> 모델: Gemini (google-genai SDK)  
> RAG: 사용 안 함 — 정적 few-shot 데모만 사용 (E1-C/D 방식)

---

## 1. 실험 구조 개요

두 개의 독립적인 실험으로 구성한다.

| 실험 | 측정 대상 | E1 대응 |
|---|---|---|
| **Exp-1** | Stage 1 인텐트 파싱 정확도 (IR 슬롯 정확도) | E1 직접 계승 |
| **Exp-2** | 전체 파이프라인 FlowRule 정확도 (Stage 1→2→3) | E1에 없는 신규 |

Exp-1은 "파싱이 얼마나 정확한가"를, Exp-2는 "파싱이 맞아도 FlowRule이 올바른가"를 측정한다.  
두 실험을 분리함으로써 IR 중간 표현 레이어의 기여를 독립적으로 정량화할 수 있다.

---

## 2. Exp-1: Stage 1 파싱 정확도

### 2-1. Treatment 설계 (E1 완전 계승)

E1과 동일하게 **출력 형식 × 입력 구성** 조합으로 treatment를 정의한다.

| Treatment | 출력 형식 | Few-Shot | 토폴로지 Grounding | E1 대응 |
|---|---|---|---|---|
| **T-A** | ONOS FlowRule JSON 직접 출력 | ❌ | ❌ | E1-A |
| **T-B** | IntentIR | ❌ | ❌ | E1-B |
| **T-C** | IntentIR | ✅ (정적 5개) | ❌ | E1-C |
| **T-D** | IntentIR | ✅ (정적 5개) | ✅ | E1-D |

**T-A의 역할 (핵심 베이스라인):**  
LLM이 IR과 컴파일러 없이 직접 ONOS FlowRule JSON을 생성하는 경우. T-B~D와 비교하여 "IR + 결정론적 컴파일러" 방식의 실질적 이점을 수치로 보여준다. 이것이 본 논문의 핵심 기여(C2) 검증이다.

**Few-Shot (T-C, T-D):**  
RAG(동적 검색) 아님. E1의 `demonstrations.json`처럼 5개의 고정 예시를 시스템 프롬프트에 삽입한다. 예시는 실험 데이터셋에 포함되지 않는 phantom 엔티티(demo-client, lab-red 등)를 사용해 데이터 유출을 방지한다.

**Grounding (T-D):**  
토폴로지 인벤토리(허용된 호스트/스위치/포트 목록)를 시스템 프롬프트에 JSON으로 삽입.

### 2-2. 시스템 프롬프트 구성

```
[T-A 프롬프트]
SYSTEM_DIRECT_FLOW (ONOS JSON 생성 지시)

[T-B 프롬프트]  
SYSTEM_IR (IntentIR 생성 지시)

[T-C 프롬프트]
SYSTEM_IR
+ "\n\nExamples:\n" + demonstrations (5개 고정)

[T-D 프롬프트]
SYSTEM_IR
+ "\n\nExamples:\n" + demonstrations
+ "\n\nAuthorized topology inventory:\n" + topology_eval.json
```

### 2-3. 모델 비교 (보조 실험)

T-D (최상 설정)에서 Gemini 모델 크기별 성능을 비교한다. 파이프라인 기본값 선택의 근거가 된다.

| 모델 ID | 분류 | 비고 |
|---|---|---|
| `gemini-2.0-flash-lite` | 소형 | 현재 파이프라인 기본값 |
| `gemini-2.0-flash` | 중형 | |
| `gemini-2.5-flash` | 고성능 | |

---

## 3. Exp-2: 전체 파이프라인 FlowRule 정확도

### 3-1. 설계 의도

E1에는 없는 실험. Stage 1 파싱이 정확해도 Stage 2 컴파일러가 올바른 ONOS FlowRule을 생성하지 못하거나, Stage 3 정적 검증에서 충돌이 발생할 수 있다. 이 실험은 **파이프라인 전체를 블랙박스로 보고** 최종 FlowRule의 품질을 측정한다.

### 3-2. Treatment

T-D (최상 설정, Gemini-2.0-flash) 고정으로 Stage 1~3을 통과한 FlowRule을 평가한다.

### 3-3. 평가 항목

| 지표 | 정의 |
|---|---|
| `compile_success_rate` | IR → FlowRule 컴파일 성공 비율 (CompileError 없음) |
| `schema_validity_rate` | 생성된 FlowRule이 ONOS Flow REST API 스키마를 통과하는 비율 |
| `static_pass_rate` | Stage 3 정적 검증 PASS 비율 (신규 룰 기준, 기존 룰 없다고 가정) |
| `end_to_end_approve_rate` | Stage 1~3 모두 통과 (APPROVE 도달) 비율 |
| `flowrule_exact_match` | 생성된 FlowRule이 gold FlowRule과 일치하는 비율 (gold가 있는 케이스만) |

`flowrule_exact_match`는 데이터셋에 gold FlowRule이 있는 케이스만 평가한다. 현재 `intents_v2.jsonl`에는 gold FlowRule이 없으므로, 핵심 케이스 20개에 gold FlowRule을 수동으로 작성하는 것을 별도 작업으로 계획한다.

---

## 4. 데이터셋

### 4-1. 현황 (`data/intents_v2.jsonl`, 100케이스)

| 카테고리 | 수 | accepted | rejected |
|---|---|---|---|
| forwarding | 15 | 15 | 0 |
| security | 15 | 15 | 0 |
| qos | 10 | 10 | 0 |
| sfc | 25 | 25 | 0 |
| reroute | 25 | 25 | 0 |
| ambiguous_unsupported | 10 | 0 | 10 |
| **합계** | **100** | **90** | **10** |

Rejection 분포: ambiguous 3 / contradictory 2 / unknown_entity 3 / unsupported 2

복합(multi-rule) 케이스: 25개 (모두 sfc 카테고리)

### 4-2. 스키마 차이와 정규화

`intents_v2.jsonl`의 gold는 `sdn_intent-framework` 스키마를, 파이프라인은 자체 `IntentIR` 스키마를 사용한다. 채점 시 정규화 레이어가 필요하다.

**Action 정규화 (gold → pipeline):**

| gold action | pipeline action |
|---|---|
| `"forward"` | `"forward"` |
| `"allow"` | `"forward"` |
| `"deny"` | `"block"` |
| `"prioritize"` | `"qos"` |

**필드 이름 정규화:**

| gold 필드 | pipeline 필드 |
|---|---|
| `selector.destination_port` | `selector.dst_port` |
| `selector.source_port` | `selector.src_port` |
| `selector.ingress_port` | `selector.in_port` |
| `enforcement.egress_port` | `enforcement.egress_port` (동일, int 변환) |
| `enforcement.device` | `enforcement.device` (alias 해석 필요) |

**Device alias 정규화:**  
gold에는 ONOS device_id (`of:0000000000000001`), 파이프라인 출력에는 자연어(`switch 1`, `s1`)가 오므로 topology_eval.json의 alias 테이블로 통일한다.

### 4-3. 데이터셋 보강 계획

현재 데이터셋의 한계:
- compound(multi-rule) 케이스가 sfc 25개뿐 — forward+block 복합 미포함
- rejected 케이스 10개 — contradictory가 2개뿐

추가 케이스:

| 유형 | 추가 수 | 예시 인텐트 |
|---|---|---|
| compound (forward+block) | 5 | "Allow HTTP from h1 to h2, but block SSH from h1 to h2 on switch 1" |
| compound (block+qos) | 3 | "Block ICMP from h1 to h3, and apply QoS queue 2 for video from h2 to h4" |
| contradictory (추가) | 3 | "Allow TCP 80 from h1 to h2 on switch 1 and block TCP 80 from h1 to h2 on switch 1" |
| unknown_entity (추가) | 2 | "Route traffic from h9 to h4 via switch 1" |

→ **목표: 113케이스 (accepted 100 / rejected 13)**

---

## 5. 평가 지표 (Exp-1 상세)

### 5-1. 주요 지표 (E1 직접 계승)

#### `response_schema_validity`
LLM 출력이 스키마 검증(T-A: ONOS FlowSet 스키마, T-B~D: IntentPrediction)을 통과한 비율.
```
schema_validity = 파싱 성공 케이스 / 전체 케이스
```

#### `normalized_exact_match`
전체 IR이 gold와 슬롯 단위로 완전 일치하는 비율. 정규화 후 비교.
```
exact_match = 완전 일치 케이스 / 전체 케이스
```
조건: status 일치 + (rejected면 reason 일치) + (accepted면 rule 수 일치 + 모든 슬롯 일치)

#### `normalized_rule_count_accuracy`
accepted 케이스에서 예측 rule 수가 gold와 일치하는 비율.
```
rule_count_accuracy = rule 수 일치 케이스 / accepted 케이스
```

#### `normalized_slot_accuracy` (슬롯별)

추적 슬롯 목록:

| 슬롯 | gold 경로 | pipeline 경로 | 비교 |
|---|---|---|---|
| `action` | `rules[*].action` | `rules[*].action` | alias 매핑 후 exact |
| `intent_type` | `rules[*].intent_type` | `rules[*].intent_type` | exact |
| `source_host` | `rules[*].selector.source.host` | `rules[*].selector.source.host` | case-insensitive |
| `source_ip` | `rules[*].selector.source.ip` | `rules[*].selector.source.ip` | IP /32 정규화 |
| `destination_host` | `rules[*].selector.destination.host` | `rules[*].selector.destination.host` | case-insensitive |
| `destination_ip` | `rules[*].selector.destination.ip` | `rules[*].selector.destination.ip` | IP /32 정규화 |
| `protocol` | `rules[*].selector.protocol` | `rules[*].selector.protocol` | exact |
| `dst_port` | `rules[*].selector.destination_port` | `rules[*].selector.dst_port` | int 정규화 |
| `src_port` | `rules[*].selector.source_port` | `rules[*].selector.src_port` | int 정규화 |
| `device` | `rules[*].enforcement.device` | `rules[*].enforcement.device` | alias 해석 후 exact |
| `egress_port` | `rules[*].enforcement.egress_port` | `rules[*].enforcement.egress_port` | int 정규화 |
| `queue` | `rules[*].qos.queue` | `rules[*].qos.queue` | int 정규화 |
| `avoid_device` | `rules[*].enforcement.avoid_device` | `rules[*].routing.avoid_device` | alias 해석 |
| `waypoints` | `program.sfc_chain` | `rules[*].routing.waypoints` | 집합 비교 |

```
slot_accuracy[slot] = Σ(slot 정답 수) / Σ(expected rule 수)
```

#### `hallucinated_entity_rate`
예측에 등장하는 엔티티 중 topology_eval.json alias에 없는 비율.
```
hallucination_rate = 환각 엔티티 수 / 전체 예측 엔티티 수
```
검사 대상: source.host, destination.host, source.ip, destination.ip, enforcement.device

#### `required_rejection_rate` (전체 + reason별)
```
rejection_recall = 올바르게 rejected / expected-rejected 전체
rejection_recall_by_reason["ambiguous"] = ...
rejection_recall_by_reason["contradictory"] = ...
rejection_recall_by_reason["unknown_entity"] = ...
rejection_recall_by_reason["unsupported"] = ...
```

#### `false_rejection_rate`
```
false_rejection_rate = 잘못 rejected / expected-accepted 전체
```

### 5-2. 보조 지표

| 지표 | 설명 |
|---|---|
| `mean_latency_ms` | 케이스당 평균 응답 지연 |
| `mean_input_tokens` | 케이스당 평균 입력 토큰 수 |
| `mean_output_tokens` | 케이스당 평균 출력 토큰 수 |
| `transport_failure_rate` | API 연결 오류 비율 |

---

## 6. 실험 실행 설계

### 6-1. 반복 및 시드

- 반복(repetition): **5회** (E1 동일)
- 시드: repetition N → seed = 41 + N (42, 43, 44, 45, 46)
- Gemini temperature: `0.0` (가능한 한 결정론적)
- 단, Gemini API는 완전 결정론적 출력을 보장하지 않으므로 5회 반복의 분산이 신뢰 구간 역할

### 6-2. 집계 방식 (E1 동일)

각 지표에 대해:
```
{
  "runs": [r1, r2, r3, r4, r5],
  "mean": μ,
  "sample_sd": σ,
  "min": min,
  "max": max,
  "bootstrap_ci_95": [lower, upper]  // seed=42, 10,000 resamples
}
```
**Bootstrap CI 주의**: n=5 기준. 탐색적 비교용, 강한 통계 추론에 사용 불가.

### 6-3. Paired 비교

각 repetition 동일 번호끼리 차이를 계산:
```
paired["T-C_minus_T-B"][metric] = [T-C_r1 - T-B_r1, ..., T-C_r5 - T-B_r5]
```
→ Grounding 단독 효과(T-D - T-C), Few-shot 효과(T-C - T-B), IR 전체 효과(T-D - T-A) 분리 가능

---

## 7. 파일 구조

```
experiments/
  eval/
    data/
      demonstrations.json          # 정적 few-shot 예시 5개 (phantom 엔티티)
      topology_eval.json            # alias 인벤토리 (평가 및 grounding 공용)
    config/
      T-A.toml                     # direct flowrule, no few-shot, no grounding
      T-B.toml                     # IR, no few-shot, no grounding
      T-C.toml                     # IR, few-shot, no grounding
      T-D.toml                     # IR, few-shot, grounding
    logs/
      T-A-gemini-flash-<uuid>-r1.jsonl
      ...
    reports/
      summary_exp1.json            # 전체 비교
      summary_exp1_by_category.json
      summary_exp2.json
    run_exp1.py                    # Exp-1 실행 스크립트
    score_exp1.py                  # Exp-1 채점 스크립트
    run_exp2.py                    # Exp-2 실행 스크립트
    score_exp2.py                  # Exp-2 채점 스크립트
```

### 예측 레코드 형식 (JSONL)

```json
{
  "case_id": "F01",
  "treatment": "T-D",
  "model": "gemini-2.0-flash",
  "run_id": "T-D-gemini-flash-a3f2b1c0",
  "repetition": 1,
  "seed": 42,
  "output": { "status": "accepted", "rules": [...] },
  "raw_content": "...",
  "latency_ms": 1234.5,
  "input_tokens": 850,
  "output_tokens": 130,
  "error_kind": null,
  "error": null
}
```

`error_kind`: `null` | `"transport"` | `"schema_invalid"` | `"timeout"`

---

## 8. 토폴로지 인벤토리 (`topology_eval.json`)

```json
{
  "topology_id": "sdn-xai-pipeline-eval-v1",
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
  },
  "capabilities": ["forwarding", "security", "qos", "sfc", "reroute"]
}
```

---

## 9. Few-Shot 데모 (`demonstrations.json`)

E1의 방식을 그대로 계승. **phantom 엔티티**를 사용해 평가 데이터 유출 방지.  
파이프라인의 IntentIR 스키마(action: block/forward/qos/sfc/reroute)에 맞게 작성.

5개 예시 구성:

| ID | 카테고리 | 커버 |
|---|---|---|
| D-FWD | forwarding | 기본 forward, enforcement.device, egress_port |
| D-BLOCK | security | action=block, protocol, dst_port |
| D-QOS | qos | action=qos, qos.queue |
| D-SFC | sfc | action=sfc, routing.waypoints, enforcement.egress_port + alt_egress_port |
| D-REJECT | rejection | status=rejected, reason=unsupported |

예시는 실험 데이터셋 외부 엔티티(`demo-client`, `lab-red`, `edge-node` 등)만 사용.

---

## 10. 기대 결과 패턴 (E1 결과 기반 가설)

E1 실험 결과(qwen3:8b 기준)에서 관찰된 패턴을 참고해 Gemini 결과를 예측한다.

| 지표 | T-A (직접) | T-B (IR) | T-C (+Few-Shot) | T-D (+Grounding) |
|---|---|---|---|---|
| schema_validity | ~0.70 | ~0.85 | ~0.90 | ~0.93 |
| exact_match | ~0.40 | ~0.65 | ~0.75 | ~0.83 |
| hallucination_rate | ~0.15 | ~0.12 | ~0.08 | ~0.02 |
| device_slot_accuracy | ~0.55 | ~0.65 | ~0.72 | ~0.88 |
| rejection_recall | ~0.30 | ~0.55 | ~0.65 | ~0.78 |

E1에서 검증된 핵심 패턴:
- **Grounding의 효과 > Few-shot의 효과** (특히 hallucination_rate와 device 슬롯에서)
- **IR 방식 자체(T-B vs T-A)**: schema_validity 약 15% 향상 (결정론적 파싱의 이점)

---

## 11. 논문 Table 형식

### Table 1: Exp-1 치료 비교 (mean ± sd, 5회 반복)

```
Treatment | Schema | ExactMatch | SlotAcc(avg) | HallucinRate | RejRecall
----------|--------|------------|-------------|--------------|----------
T-A Direct|  0.xx  |    0.xx    |     0.xx    |    0.xx      |   0.xx
T-B IR    |  0.xx  |    0.xx    |     0.xx    |    0.xx      |   0.xx
T-C +FS   |  0.xx  |    0.xx    |     0.xx    |    0.xx      |   0.xx
T-D +G    |  0.xx  |    0.xx    |     0.xx    |    0.xx      |   0.xx
```

### Table 2: T-D 슬롯별 정확도

```
Slot          | T-A  | T-B  | T-C  | T-D
--------------|------|------|------|------
action        | 0.xx | 0.xx | 0.xx | 0.xx
source_ip     | 0.xx | 0.xx | 0.xx | 0.xx
destination_ip| 0.xx | 0.xx | 0.xx | 0.xx
protocol      | 0.xx | 0.xx | 0.xx | 0.xx
dst_port      | 0.xx | 0.xx | 0.xx | 0.xx
device        | 0.xx | 0.xx | 0.xx | 0.xx
egress_port   | 0.xx | 0.xx | 0.xx | 0.xx
```

### Table 3: Exp-2 파이프라인 전체 (T-D, gemini-2.0-flash)

```
Metric                    | Rate
--------------------------|------
compile_success           | 0.xx
schema_validity (FlowRule)| 0.xx
static_pass               | 0.xx
end_to_end_approve        | 0.xx
```

### Table 4: 모델 크기 비교 (T-D 설정)

```
Model               | ExactMatch | HallucinRate | Latency(ms) | Tokens
--------------------|------------|-------------|-------------|-------
gemini-2.0-flash-lite|   0.xx   |    0.xx     |    xxx      |  xxx
gemini-2.0-flash    |   0.xx    |    0.xx     |    xxx      |  xxx
gemini-2.5-flash    |   0.xx    |    0.xx     |    xxx      |  xxx
```

---

## 12. 구현 순서

| 단계 | 작업 | 산출물 |
|---|---|---|
| 1 | `topology_eval.json` 작성 | alias 인벤토리 |
| 2 | `demonstrations.json` 작성 (phantom 엔티티, 파이프라인 스키마) | 5개 데모 |
| 3 | `score_exp1.py` — 정규화·채점 엔진 | 채점 모듈 |
| 4 | `run_exp1.py` — Gemini API 배치 실행 | 실행 스크립트 |
| 5 | T-B, T-C, T-D 5회×3 treatment 실행 (T-A는 별도) | 45개 JSONL |
| 6 | `score_exp1.py` 실행 → 리포트 생성 | summary_exp1.json |
| 7 | 데이터셋 보강 (compound/rejection 추가 13개) | intents_v2_ext.jsonl |
| 8 | `run_exp2.py` + `score_exp2.py` (Exp-2) | summary_exp2.json |
| 9 | 모델 비교 실험 (T-D × 3모델) | summary_model_cmp.json |

---

## 13. 주의사항

- **Gold 상태**: `intents_v2.jsonl`은 `provisional_gold` (단일 annotator). 논문 게재 전 2인 이상 독립 검증 필요.
- **T-A 스키마**: ONOS FlowRule JSON 스키마를 별도 정의해야 함 (E1의 `OnosFlowSet`에 해당). 파이프라인 Stage 3의 JSON Schema를 재사용 가능.
- **SFC/Reroute**: 이 카테고리는 enforcement 필드가 많아 slot_accuracy가 낮게 나올 수 있음. 카테고리별 분리 리포트 필수.
- **데이터 유출 방지**: demonstrations.json의 엔티티가 intents_v2.jsonl 케이스에 등장하지 않아야 함. phantom 엔티티(`demo-*`, `lab-*`) 전용으로 작성.
- **Gemini API 결정론적 출력**: temperature=0이어도 완전 결정론적 아님. 5회 반복 분산이 변동성 측정 역할.
