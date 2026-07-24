# 정량 평가 프레임워크 계획

> 작성: 2026-07-20 / 최종 수정: 2026-07-21  
> 참조: `sdn_intent-framework/experiments/e1` 설계 구조를 직접 계승  
> 모델: `gemini-3.1-flash-lite` (google-genai SDK)  
> RAG: 사용 안 함 — 정적 few-shot 데모만 사용 (E1-C/D 방식)

---

## 1. 실험 구조 개요

세 개의 독립적인 실험으로 구성한다.

| 실험 | 측정 대상 | 범위 |
|---|---|---|
| **Exp-1** | Stage 1 인텐트 파싱 정확도 (IR 슬롯 정확도) | Stage 1 출력만 채점 |
| **Exp-2** | Stage 1→2→3 파이프라인 통과율 | 파이프라인 실행 포함 |
| **Exp-3** | 전체 파이프라인 블랙박스 평가 | Stage 1~6 End-to-End |

**현재 구현 범위:** Exp-1 (Stage 1 파싱 정확도)만 선행 구현.  
Exp-2(Stage 1→2→3)와 Exp-3(전체 E2E)은 별도 실험으로 분리 진행.

---

## 2. Exp-1: Stage 1 파싱 정확도

### 2-1. Treatment 설계

| Treatment | 출력 형식 | Few-Shot | 토폴로지 Grounding | 비교 목적 |
|---|---|---|---|---|
| **T-A** | ONOS FlowRule JSON 직접 출력 | ❌ | ❌ | 핵심 베이스라인 — IR 없이 LLM 직접 생성 |
| **T-B** | IntentIR | ❌ | ❌ | IR 효과만 분리 |
| **T-C** | IntentIR | ✅ (정적 5개) | ❌ | Few-shot 효과 분리 |
| **T-D** | IntentIR | ✅ (정적 5개) | ✅ | 현재 파이프라인 최상 설정 |

**비교 포인트:**

| 비교 | 측정하는 효과 |
|---|---|
| T-A vs T-B | IR + 결정론적 컴파일러의 순수 기여 → **논문의 핵심 주장 검증** |
| T-B vs T-C | Few-shot 단독 기여 |
| T-C vs T-D | Grounding 단독 기여 |
| T-B vs T-D | Few-shot + Grounding 결합 효과 |

**T-A 채점 방식:**  
T-A는 IntentIR이 아닌 ONOS FlowRule JSON을 출력한다. 공통 지표(`schema_validity`, `status_match`)는 T-A용 FlowRule 스키마로 채점하고, 슬롯 정확도 지표는 T-B~D(IntentIR 기반)와 직접 비교하지 않는다. T-A의 주된 비교 지표는 `schema_validity`와 `false_rejection_rate`이다.

### 2-2. 시스템 프롬프트 구성

```
[T-A]  SYSTEM_DIRECT_FLOW (ONOS FlowRule JSON 생성 지시)

[T-B]  SYSTEM_IR (IntentIR 생성 지시)

[T-C]  SYSTEM_IR
       + "\n\nExamples:\n" + demonstrations.json (5개 고정)

[T-D]  SYSTEM_IR
       + "\n\nExamples:\n" + demonstrations.json
       + "\n\nAuthorized topology inventory:\n" + topology_eval.json
```

### 2-3. 모델

`gemini-3.1-flash-lite` 단일 모델만 사용. 추후 여건에 따라 모델 비교 보조 실험 추가 가능.

---

## 3. Exp-2: Stage 1→2→3 파이프라인 통과율 (별도 실험)

T-D (최상 설정) 고정으로 Stage 1 파싱 → Stage 2 컴파일 → Stage 3 정적 검증까지의 통과율을 측정한다.

| 지표 | 정의 |
|---|---|
| `compile_success_rate` | IR → FlowRule 컴파일 성공 비율 |
| `schema_validity_rate` | FlowRule이 ONOS REST API 스키마 통과 비율 |
| `static_pass_rate` | Stage 3 정적 검증 PASS 비율 |
| `end_to_end_approve_rate` | Stage 1~3 모두 통과 비율 |

---

## 4. Exp-3: 전체 파이프라인 블랙박스 평가 (별도 실험)

Stage 1~6 전 과정을 블랙박스로 보고 최종 FlowRule 배포 성공 여부를 측정한다. 디지털 트윈(Stage 4) 통과 여부, XAI 설명 생성(Stage 5) 품질 등을 포함한다.

---

## 5. 데이터셋

### 5-1. 신규 평가 데이터셋 (`experiments/eval/data/`)

기존 `data/intents_v2.jsonl`(E1 스키마)과 별개로, **파이프라인 IntentIR 스키마를 직접 gold로 사용**하는 신규 데이터셋을 작성했다. 정규화 레이어 불필요.

#### Small 토폴로지 (기본 실험)

| 항목 | 값 |
|---|---|
| 파일 | `experiments/eval/data/intents_eval.jsonl` |
| 토폴로지 | `topology_eval.json` (h1–h4, s1–s4) |
| 총 케이스 | 60 |
| accepted : rejected | 54 : 6 = **9 : 1** |
| 카테고리 | 6개 × 10케이스 (accepted 9 + rejected 1) |

| 카테고리 | accepted | rejected | 거부 이유 |
|---|---|---|---|
| forwarding | 9 | 1 | ambiguous |
| security | 9 | 1 | unknown_entity |
| qos | 9 | 1 | unsupported |
| sfc | 9 | 1 | ambiguous |
| reroute | 9 | 1 | contradictory |
| compound | 9 | 1 | unknown_entity |

#### Large 토폴로지 (일반화 실험)

| 항목 | 값 |
|---|---|
| 파일 | `experiments/eval/data/intents_eval_large.jsonl` |
| 토폴로지 | `topology_large.json` (h1–h16, s1–s8, IDS at s1:9 & s3:9) |
| 총 케이스 | 60 |
| accepted : rejected | 54 : 6 = **9 : 1** |
| 카테고리 | 6개 × 10케이스 (accepted 9 + rejected 1) |

| 카테고리 | accepted | rejected | 거부 이유 |
|---|---|---|---|
| forwarding | 9 | 1 | unknown_entity |
| security | 9 | 1 | ambiguous |
| qos | 9 | 1 | contradictory |
| sfc | 9 | 1 | unsupported |
| reroute | 9 | 1 | ambiguous |
| compound | 9 | 1 | contradictory |

**Large 실험 목적:** 토폴로지 규모 증가 시 hallucination_rate 변화와 grounding 효과의 스케일 강건성을 측정. Small 실험 완료 후 보완 방향 확정 후 진행.

### 5-2. Gold 정의 및 검증

**Gold = 수동 작성한 정답 IntentIR JSON.** 각 케이스에 대해 "LLM이 이렇게 출력해야 맞다"는 기준값.

**Gold Validation (미완료):** 수락 케이스 54개(Small)의 gold JSON을 실제 파이프라인 Stage 1→2에 통과시켜 컴파일 성공을 확인해야 gold 자체의 정확성이 보장됨. 현재 미검증 상태이며 run_exp1.py 구현 전에 완료 권장.

### 5-3. Gold 스키마

```json
// 수락 케이스 (단일 룰)
{
  "case_id": "FWD-01",
  "category": "forwarding",
  "intent_text": "...",
  "gold": {
    "status": "accepted",
    "action": "forward|block|qos|sfc|reroute",
    "intent_type": "forwarding|security|qos|sfc|reroute",
    "selector": {
      "source": {"host": "h1", "ip": "10.0.0.1"},
      "destination": {"host": "h2", "ip": "10.0.0.2"},
      "protocol": "tcp|udp|icmp|null",
      "dst_port": 80
    },
    "enforcement": {"device": "switch 1", "egress_port": 2},
    "qos": null,
    "routing": null
  }
}

// 거부 케이스
{
  "case_id": "FWD-R01",
  "category": "forwarding",
  "rejection_type": "ambiguous",
  "intent_text": "...",
  "gold": {"status": "rejected", "rejection_reason": "ambiguous"}
}

// 복합 케이스
{
  "case_id": "CMP-01",
  "gold": {
    "status": "accepted",
    "rules": [{...rule1...}, {...rule2...}]
  }
}
```

---

## 6. 평가 지표 (Exp-1)

### 6-1. 공통 지표 (T-A ~ T-D)

| 지표 | 정의 |
|---|---|
| `schema_validity` | LLM 출력 파싱 성공 비율 (T-A: FlowRule 스키마, T-B~D: IntentIR 스키마) |
| `status_match` | gold accepted/rejected ↔ 예측 일치 비율 |
| `false_rejection_rate` | 수락해야 할 케이스를 rejected로 잘못 예측한 비율 |
| `rejection_recall` | 거부 케이스를 올바르게 rejected로 예측한 비율 |
| `rejection_reason_match` | rejection_reason까지 gold와 일치하는 비율 |

### 6-2. IntentIR 슬롯 지표 (T-B ~ T-D만 적용)

| 슬롯 | gold 경로 | 비교 방식 |
|---|---|---|
| `action` | `gold.action` | exact (no alias — 파이프라인 스키마 동일) |
| `intent_type` | `gold.intent_type` | exact |
| `source_host` | `gold.selector.source.host` | case-insensitive |
| `source_ip` | `gold.selector.source.ip` | /32 정규화 후 exact |
| `destination_host` | `gold.selector.destination.host` | case-insensitive |
| `destination_ip` | `gold.selector.destination.ip` | /32 정규화 후 exact |
| `protocol` | `gold.selector.protocol` | exact |
| `dst_port` | `gold.selector.dst_port` | int 정규화 |
| `device` | `gold.enforcement.device` | topology alias 해석 후 exact |
| `egress_port` | `gold.enforcement.egress_port` | int 정규화 |
| `alt_egress_port` | `gold.enforcement.alt_egress_port` | int 정규화 (SFC만) |
| `queue` | `gold.qos.queue` | int 정규화 (QoS만) |
| `waypoints` | `gold.routing.waypoints` | 집합 비교 |
| `avoid_device` | `gold.routing.avoid_device` | alias 해석 |

- Gold에서 `null`인 슬롯은 채점 제외
- 복합 인텐트: order-agnostic best-match alignment 적용 (predicted rules를 gold rules 순서에 최적 매칭)

### 6-3. 환각 지표 (T-B ~ T-D)

```
hallucinated_entity_rate = 환각 엔티티 수 / 전체 예측 엔티티 수
```
검사 대상: `source.host`, `destination.host`, `source.ip`, `destination.ip`, `enforcement.device`  
기준: topology JSON의 alias 테이블에 없으면 환각으로 판정.

### 6-4. 보조 지표

| 지표 | 설명 |
|---|---|
| `mean_latency_ms` | 케이스당 평균 응답 지연 |
| `mean_input_tokens` | 케이스당 평균 입력 토큰 |
| `mean_output_tokens` | 케이스당 평균 출력 토큰 |
| `transport_failure_rate` | API 연결 오류 비율 |

---

## 7. 실험 실행 설계

### 7-1. 반복 및 시드

- 반복(repetition): **10회**
- Temperature: `0.2` (파이프라인 프로덕션 설정과 동일)
- Gemini API는 seed 파라미터 미지원 → 10회 반복은 temperature=0.2의 자연 분산을 측정

| repetition | bootstrap seed (CI 계산용) |
|---|---|
| 1 | 42 |
| 2 | 43 |
| ... | ... |
| 10 | 51 |

Bootstrap seed는 `score_exp1.py`의 10,000회 재샘플링에만 사용. LLM 호출에는 무관.

### 7-2. 집계 방식

각 지표에 대해:
```json
{
  "runs": [r1, r2, ..., r10],
  "mean": μ,
  "sample_sd": σ,
  "min": min,
  "max": max,
  "bootstrap_ci_95": [lower, upper]
}
```
Bootstrap CI: n=10, seed=42, 10,000 resamples. 탐색적 비교용.

### 7-3. Paired 비교

동일 repetition 번호끼리 차이를 계산:
```python
paired["T-C_minus_T-B"][metric] = [T-C_r1 - T-B_r1, ..., T-C_r10 - T-B_r10]
```
→ Grounding 효과(T-D−T-C), Few-shot 효과(T-C−T-B), IR 기여(T-B−T-A) 분리 가능

---

## 8. 파일 구조

```
experiments/eval/
├── data/
│   ├── intents_eval.jsonl          ✅ Small (60케이스, 9:1, h1–h4, s1–s4)
│   ├── intents_eval_large.jsonl    ✅ Large (60케이스, 9:1, h1–h16, s1–s8)
│   ├── topology_eval.json          ✅ Small 토폴로지 alias 인벤토리
│   ├── topology_large.json         ✅ Large 토폴로지 alias 인벤토리
│   ├── demonstrations.json         ✅ 정적 few-shot 5개 (phantom 엔티티)
│   └── DATASET_PLAN.md             ✅ 데이터셋 설계 문서
├── config/
│   ├── T-A.toml / T-B.toml / T-C.toml / T-D.toml         ✅ Small 실험
│   └── T-A-large.toml / T-B-large.toml / T-C-large.toml / T-D-large.toml  ✅ Large 실험
├── logs/                           — 실행 결과 JSONL (gitignore 권장)
├── reports/                        — 채점 결과 JSON
├── run_exp1.py                     🔲 미구현
├── score_exp1.py                   🔲 미구현
├── run_exp2.py                     🔲 미구현 (별도 실험)
└── score_exp2.py                   🔲 미구현 (별도 실험)
```

### 예측 레코드 형식 (JSONL)

```json
{
  "case_id": "FWD-01",
  "treatment": "T-D",
  "model": "gemini-3.1-flash-lite",
  "run_id": "T-D-gemini-flash-lite-a3f2b1c0",
  "repetition": 1,
  "output": {"status": "accepted", "action": "forward", ...},
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

## 9. 토폴로지 인벤토리

### Small (`topology_eval.json`)

- 호스트: h1–h4 (10.0.0.1–10.0.0.4)
- 스위치: s1–s4 (of:000...001–004)
- s1 포트: 1,2,3,4,9 (포트 9 = IDS 웨이포인트)
- s2–s4 포트: 1,2,3,4
- Phantom 엔티티 (거부 케이스용): h5, h6, h7, s9

### Large (`topology_large.json`)

- 호스트: h1–h16 (10.0.0.1–10.0.0.16)
- 스위치: s1–s8 (of:000...001–008)
- IDS 웨이포인트: s1:9, s3:9 (2개 — Small보다 복잡한 SFC 테스트)
- s1, s3 포트: 1–9, 나머지 s2,s4–s8 포트: 1–8
- Phantom 엔티티: h17, h18, h19, h20, s9, s10

---

## 10. Few-Shot 데모 (`demonstrations.json`)

**phantom 엔티티**로만 구성해 평가 데이터 유출 방지. 파이프라인 IntentIR 스키마 사용.

| ID | 카테고리 | 커버 |
|---|---|---|
| D-FWD | forwarding | action=forward, enforcement.device, egress_port |
| D-BLOCK | security | action=block, protocol, dst_port |
| D-QOS | qos | action=qos, qos.queue |
| D-SFC | sfc | action=sfc, routing.waypoints, egress_port + alt_egress_port |
| D-REJECT | rejection | status=rejected, reason=unsupported |

---

## 11. 기대 결과 패턴 (가설)

E1(qwen3:8b) 결과를 참고한 Gemini 예측.

| 지표 | T-A (직접) | T-B (IR) | T-C (+FS) | T-D (+G) |
|---|---|---|---|---|
| schema_validity | ~0.70 | ~0.85 | ~0.90 | ~0.93 |
| exact_match | ~0.40 | ~0.65 | ~0.75 | ~0.83 |
| hallucination_rate | ~0.15 | ~0.12 | ~0.08 | ~0.02 |
| device_slot_accuracy | ~0.55 | ~0.65 | ~0.72 | ~0.88 |
| rejection_recall | ~0.30 | ~0.55 | ~0.65 | ~0.78 |

---

## 12. 논문 Table 형식

### Table 1: Exp-1 Treatment 비교 (mean ± sd, n=10)

```
Treatment  | Schema | ExactMatch | SlotAcc(avg) | HallucinRate | RejRecall
-----------|--------|------------|--------------|--------------|----------
T-A Direct | 0.xx   |   0.xx     |    0.xx      |    0.xx      |   0.xx
T-B IR     | 0.xx   |   0.xx     |    0.xx      |    0.xx      |   0.xx
T-C +FS    | 0.xx   |   0.xx     |    0.xx      |    0.xx      |   0.xx
T-D +G     | 0.xx   |   0.xx     |    0.xx      |    0.xx      |   0.xx
```

### Table 2: T-D 슬롯별 정확도 (전 treatment 비교)

```
Slot           | T-B  | T-C  | T-D
---------------|------|------|------
action         | 0.xx | 0.xx | 0.xx
source_ip      | 0.xx | 0.xx | 0.xx
destination_ip | 0.xx | 0.xx | 0.xx
protocol       | 0.xx | 0.xx | 0.xx
dst_port       | 0.xx | 0.xx | 0.xx
device         | 0.xx | 0.xx | 0.xx
egress_port    | 0.xx | 0.xx | 0.xx
waypoints      | 0.xx | 0.xx | 0.xx
```

### Table 3: 토폴로지 스케일 비교 (T-D 고정, Small vs Large)

```
Metric             | Small (60) | Large (60)
-------------------|------------|------------
schema_validity    | 0.xx       | 0.xx
hallucination_rate | 0.xx       | 0.xx
rejection_recall   | 0.xx       | 0.xx
```

---

## 13. 구현 순서

| 단계 | 작업 | 상태 |
|---|---|---|
| 1 | `topology_eval.json` 작성 | ✅ 완료 |
| 2 | `topology_large.json` 작성 (16h+8s) | ✅ 완료 |
| 3 | `demonstrations.json` 작성 | ✅ 완료 |
| 4 | `intents_eval.jsonl` 작성 (Small, 60케이스) | ✅ 완료 |
| 5 | `intents_eval_large.jsonl` 작성 (Large, 60케이스) | ✅ 완료 |
| 6 | config 파일 8개 작성 (T-A~D, T-A~D-large) | ✅ 완료 |
| 7 | **Gold Validation**: 수락 케이스 54개를 파이프라인 Stage 1→2 통과 확인 | 🔲 미완료 |
| 8 | `run_exp1.py` — Gemini API 배치 실행 (n=10) | 🔲 미구현 |
| 9 | `score_exp1.py` — 채점 엔진 (order-agnostic 복합 매칭 포함) | 🔲 미구현 |
| 10 | Small 실험 실행 (T-A~D × 10회) | 🔲 미실행 |
| 11 | Small 결과 분석 → 보완점 확인 | 🔲 미실행 |
| 12 | Large 실험 실행 (T-D × 10회) | 🔲 미실행 |
| 13 | `run_exp2.py` + `score_exp2.py` (Exp-2, 별도) | 🔲 미구현 |

---

## 15. GOLD-350 — 팀원이 작성한 이중검증 데이터셋 (2026-07-23 추가)

`docs/dataset/`(`gold.jsonl` 350케이스 + `DATASET_CARD.md` + `ANNOTATION_GUIDELINE.md`)에 팀원이
작성한 데이터셋이 추가됨. §14의 "Gold 검증 필요" 항목이 사실상 이 데이터셋으로 해결된다 —
독립 이중 라벨링 + adjudication(Cohen's κ=1.000)을 이미 거쳤고, 단일 작성자였던 기존
`intents_eval.jsonl`(60케이스)보다 규모(350케이스, 7카테고리 균등 50개씩)와 검증 수준 모두 우위.

- 변환기: `experiments/eval/convert_gold350.py` (GOLD-350 스키마 → Exp-1 gold 스키마)
- 변환 결과: `experiments/eval/data/gold350_eval.jsonl` (350/350 변환 성공)
- **검증 완료**: `python experiments/eval/validate_gold.py --dataset experiments/eval/data/gold350_eval.jsonl`
  → accepted 300/300 케이스 전부 Stage1 IR 구성 + Stage2 컴파일 PASS. score_exp1.py 자기 자신
  대비 채점(self-score) 결과도 300/300 NEM=1.0 — 스키마 변환 정확성 확인됨.
- **스키마 차이 (변환기가 처리)**: GOLD-350은 action이 3그룹(forward/deny/prioritize/allow)이고
  intent_type(7종)이 별도 필드 — pipeline은 action 자체가 5종(forward/block/qos/sfc/reroute).
  변환기는 intent_type 기준으로 action을 재매핑한다. SFC는 GOLD-350이 ingress/transit/egress로
  미리 쪼개져 있어(`sfc_role` 태그) 이를 단일 `action=sfc` + `routing.waypoints` IR로 재합성한다.
- **알아둘 한계 2가지**:
  1. Multi-hop SFC(체인 길이 2, 4케이스: G-SFC-031~034)는 gold IR로는 정확하지만
     `stage2_flowrule/compiler.py`가 `waypoints[0]`만 컴파일함 — Exp-1(Stage1 IR 채점)은 안전,
     Exp-2/3(전체 파이프라인 실행)에는 아직 못 씀.
  2. GOLD-350의 reroute 카테고리는 `routing.via_device` 개념이 없음(enforcement만으로 경로
     변경을 표현) — 기존 `intents_eval.jsonl`과 컨벤션이 다르다. score_exp1.py는 gold가 null인
     슬롯을 채점에서 제외하므로 크래시는 없지만, 이 데이터셋의 reroute 케이스는 via_device/
     avoid_device 슬롯이 항상 채점 제외된다.
- **결정 (2026-07-23): GOLD-350을 Exp-1 주 데이터셋으로 교체함.** `experiments/eval/config/
  T-A.toml`~`T-D.toml`(Small 트랙 4개)의 `dataset_path`를 전부 `gold350_eval.jsonl`로 변경.
  `T-A-large.toml`~`T-D-large.toml`(Large 트랙)은 별개 토폴로지 기준이라 변경 안 함.
  기존 `intents_eval.jsonl`(60케이스)은 삭제하지 않고 보관 — 필요시 참고용/교차검증용으로 남김.
  **주의**: 기존 T-D 진행분(rep 1~7,10, run_id `67f49bee` 등)은 60케이스 기준이라 350케이스
  기준 채점과 호환 안 됨 — case_id 자체가 다름(`FWD-01` vs `G-FWD-001`). **T-A/B/C/D 전부
  gold350_eval.jsonl 기준으로 처음부터 다시 실행해야 함.** `run_exp1.py`/`score_exp1.py`
  dry-run으로 350케이스 정상 로드 확인됨(추가 코드 수정 불필요).

## 14. 주의사항

- **Gold 검증 필요**: `intents_eval.jsonl` gold는 단일 작성자. 논문 게재 전 파이프라인 실행 검증 + 2인 독립 리뷰 권장. → **2026-07-23: 15장의 GOLD-350으로 사실상 해결됨** (기존 60케이스 자체가 아니라, 더 크고 검증된 대체/보완 데이터셋 확보).
- **T-A 채점 분리**: T-A는 FlowRule JSON 스키마로 채점. IntentIR 슬롯 지표(T-B~D)와 직접 비교 불가. 공통 지표(`schema_validity`, `status_match`, `rejection_recall`)로만 T-A vs T-B 비교.
- **복합 인텐트 매칭**: 예측 rules 배열과 gold rules 배열이 순서 다를 수 있음 → order-agnostic best-match 알고리즘 적용 필수.
- **Large 실험 시기**: Small 실험 완료 후 결과 분석 → 보완 방향 결정 후 Large 진행.
- **Exp-2, Exp-3**: 별도 실험 파일(`run_exp2.py`, `run_exp3.py`)로 분리. 현재 미구현.
- **Gemini seed 없음**: temperature=0.2에서 n=10 반복은 자연 분산 측정. Bootstrap CI는 탐색적 수준.
