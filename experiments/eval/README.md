# Exp-1 & Exp-2: 정량 평가 프레임워크

> 브랜치: `exp/eval-framework`  
> 상세 계획: `docs/EVAL_PLAN.md`

---

## 디렉토리 구조

```
experiments/eval/
├── data/
│   ├── topology_eval.json       ✅ 완료 — alias 인벤토리 (grounding + 채점 공용)
│   └── demonstrations.json      ✅ 완료 — 정적 few-shot 데모 5개 (phantom 엔티티)
├── config/
│   ├── T-A.toml                 ✅ 완료 — Direct FlowRule (baseline)
│   ├── T-B.toml                 ✅ 완료 — IR Zero-Shot
│   ├── T-C.toml                 ✅ 완료 — IR + Few-Shot
│   └── T-D.toml                 ✅ 완료 — IR + Few-Shot + Grounding
├── logs/                        — 실행 결과 JSONL (gitignore 권장)
├── reports/                     — 채점 결과 JSON
├── run_exp1.py                  🔲 미구현 — Gemini API 배치 실행
├── score_exp1.py                🔲 미구현 — 채점 엔진
├── run_exp2.py                  🔲 미구현 — 파이프라인 레벨 평가 실행
└── score_exp2.py                🔲 미구현 — Exp-2 채점
```

---

## Treatment 요약

| Treatment | 출력 형식 | Few-Shot | Grounding | 역할 |
|---|---|---|---|---|
| **T-A** | ONOS FlowRule JSON | ❌ | ❌ | 핵심 베이스라인 — IR 없이 LLM 직접 생성 |
| **T-B** | IntentIR | ❌ | ❌ | IR 효과만 분리 |
| **T-C** | IntentIR | ✅ | ❌ | Few-shot 효과 분리 |
| **T-D** | IntentIR | ✅ | ✅ | 현재 파이프라인 설정 (최상) |

비교 포인트:
- **T-A vs T-B**: IR + 컴파일러의 순수 기여
- **T-B vs T-C**: Few-shot의 기여
- **T-C vs T-D**: Grounding의 기여
- **T-B vs T-D**: 두 기법 결합 효과

---

## Exp-1 실행 순서

### 1. run_exp1.py 구현 후 실행

```bash
# treatment × repetition 단위 실행
python experiments/eval/run_exp1.py \
  --config experiments/eval/config/T-D.toml \
  --repetition 1 \
  --output experiments/eval/logs/

# 5회 반복 (repetition 1~5), 4 treatment 총 20회 실행
```

**내부 동작:**
1. `data/intents_v2.jsonl` 로드 (100케이스)
2. config에 따라 시스템 프롬프트 구성:
   - T-A: `SYSTEM_DIRECT_FLOW`
   - T-B: `SYSTEM_IR`
   - T-C: `SYSTEM_IR` + few-shot 데모
   - T-D: `SYSTEM_IR` + few-shot 데모 + topology grounding
3. Gemini API 호출 (google-genai SDK)
4. 출력 파싱 + 스키마 검증
5. 예측 레코드 JSONL 저장

**출력 파일:** `logs/T-D-gemini-flash-<uuid>-r1.jsonl`

**예측 레코드 형식:**
```json
{
  "case_id": "F01",
  "treatment": "T-D",
  "model": "gemini-2.0-flash",
  "run_id": "T-D-gemini-flash-a3f2b1c0",
  "repetition": 1,
  "seed": 42,
  "output": {"status": "accepted", "rules": [...]},
  "raw_content": "...",
  "latency_ms": 1234.5,
  "input_tokens": 850,
  "output_tokens": 130,
  "error_kind": null,
  "error": null
}
```

`error_kind`: `null` | `"transport"` | `"schema_invalid"` | `"timeout"`

### 2. score_exp1.py 실행

```bash
python experiments/eval/score_exp1.py \
  --dataset data/intents_v2.jsonl \
  --topology experiments/eval/data/topology_eval.json \
  --logs experiments/eval/logs/ \
  --output experiments/eval/reports/summary_exp1.json
```

---

## Exp-2 실행 순서

T-D 설정(최상)으로 Stage 1→2→3 전체 파이프라인 통과 여부를 측정.

```bash
python experiments/eval/run_exp2.py \
  --config experiments/eval/config/T-D.toml \
  --repetition 1 \
  --output experiments/eval/logs/
```

측정 지표: `compile_success` / `schema_validity` / `static_pass` / `end_to_end_approve`

---

## 채점 지표 요약 (Exp-1)

| 지표 | 설명 |
|---|---|
| `schema_validity` | LLM 출력 파싱 성공률 |
| `normalized_exact_match` | gold IR과 완전 일치율 |
| `rule_count_accuracy` | 복합 인텐트 rule 수 일치율 |
| `slot_accuracy[slot]` | action/src_ip/dst_ip/device/port 등 슬롯별 |
| `hallucinated_entity_rate` | 토폴로지에 없는 엔티티 비율 |
| `rejection_recall` | 거부 케이스 탐지율 (reason별) |
| `false_rejection_rate` | 허용 케이스 오거부율 |

Gold action 정규화: `deny→block`, `allow→forward`, `prioritize→qos`

---

## 시드 규칙

| repetition | seed |
|---|---|
| 1 | 42 |
| 2 | 43 |
| 3 | 44 |
| 4 | 45 |
| 5 | 46 |

---

## .gitignore 권장

```
experiments/eval/logs/
experiments/eval/reports/
```

결과 파일은 용량이 크고 API 비용이 들어간 산출물이므로 별도 관리 권장.
