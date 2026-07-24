# Exp-1 T-A~D 종합 비교 보고서 — qwen3-8b (OpenRouter) × GOLD-350 (rep 1)

> 작성일: 2026-07-24
> 모델: `qwen/qwen3-8b` (OpenRouter) | Temperature: `0.2` | max_tokens: `8192` | reasoning 예산 제한 없음
> 실행: `--concurrency 20` (T-A/B/C 각 1건씩 프로세스 중단 → 수동 보강 후 350/350 확보, 9장 참고)
> 데이터셋: `gold350_eval.jsonl` (GOLD-350: 350 cases = accepted 300 / rejected 50, 7카테고리 × 50)
> Repetitions: **1** (treatment당) — 단일 rep 결과이므로 수치 변동 가능성 감안할 것 (10장)

| Treatment | run_id | 채점 리포트 |
|---|---|---|
| T-A | `T-A-qwen-qwen3-8b-ce969254` | `reports/T-A_openrouter_r1_summary.json` |
| T-B | `T-B-qwen-qwen3-8b-d6df6194` | `reports/T-B_openrouter_r1_summary.json` |
| T-C | `T-C-qwen-qwen3-8b-423b2838` | `reports/T-C_openrouter_r1_summary.json` |
| T-D | `T-D-qwen-qwen3-8b-ede0ac95` | `reports/T-D_openrouter_r1_summary.json` |

---

## 0. 결론 먼저 — T-A 결과는 실험 설계 결함으로 무효, T-C→T-D(grounding) 효과만 깨끗하게 해석 가능

**T-A는 그대로 논문에 쓸 수 없다.** `run_exp1.py`에 하드코딩된 T-A 전용 프롬프트(`SYSTEM_DIRECT_FLOW`)가 GOLD-350 채택 시점(2026-07-23)에 프로덕션 `intent_parser.SYSTEM_PROMPT`에 적용된 "selector completeness" 완화(F2)를 반영하지 못한 채 옛날 규칙("forward/block은 src+dst IP 둘 다 필수")을 그대로 쓰고 있다. 1장에서 상세히 다룬다.

**T-B → T-C → T-D는 정상 비교 가능**하며, 결과는 뚜렷하다:

| 비교 | 측정하는 효과 | 결과 |
|---|---|---|
| T-B vs T-C | Few-shot 단독 기여 | NEM 거의 변화 없음(0.164→0.149, 오히려 소폭 하락), status_match는 개선(+0.066) |
| **T-C vs T-D** | **Grounding 단독 기여** | **NEM +0.543 (0.149→0.692)** — 압도적. IP 슬롯 정확도가 grounding 켜자마자 0.09~0.14대에서 0.91대로 도약 |

---

## 1. T-A가 왜 깨졌는가 — 프롬프트 버전 불일치 (실험 결함, 모델 결함 아님)

T-A는 `status_match=0.183`, `false_rejection_rate=0.953`로 사실상 전멸 수준이다. 원인을 추적한 결과:

```python
# run_exp1.py의 SYSTEM_DIRECT_FLOW (T-A 전용, 현재 상태)
"src/dst IP requirements:
- For forward and block: BOTH source IP and destination IP must be specified.
  If either is missing, reject with reason 'ambiguous'."
```

```python
# pipeline/stage1_intent/intent_parser.py의 SYSTEM_PROMPT (T-B/C/D가 쓰는 프로덕션 프롬프트, F2 개정 후)
"## Selector completeness requirements
- A rule is VALID as long as its selector has at least ONE concrete match criterion...
  One-sided flows ARE supported:
  Valid: 'On switch 1, drop all traffic from 10.0.0.1' (source only)
  ..."
```

GOLD-350은 ANNOTATION_GUIDELINE §2 기준으로 **단방향(source만 또는 destination만) flow도 accepted로 라벨링**돼 있다. T-B/C/D는 이 철학에 맞춰 프롬프트가 완화됐지만, **T-A의 `SYSTEM_DIRECT_FLOW`는 이 개정이 적용되기 전 버전 그대로 방치**돼 있었다.

**정량적 확인**: accepted-gold 300건 중 284건이 rejected로 답변됐고, 그 중 **208건(73%)의 거부 사유에 명시적으로 "source/destination IP" 미비가 언급**된다. 나머지(unknown_entity 32건, unsupported 17건 등)는 T-A가 grounding도 꺼져 있어(`grounding=false`) 호스트 이름(h1 등)을 IP로 변환할 방법이 애초에 없었던 것과 겹쳐 있다 — 즉 "옛날 완결성 규칙 + grounding 없음"이 이중으로 겹쳐 거의 모든 host-이름 기반 인텐트를 거부하게 만든 것이다.

**이건 "IR 없이 직접 FlowRule을 생성하면 성능이 나쁘다"는 결과가 아니라, "두 treatment가 서로 다른 버전의 프롬프트로 평가됐다"는 실험 설계 오류다.** T-A vs T-B 비교(EVAL_PLAN.md가 "논문의 핵심 주장 검증"이라고 명시한 비교)는 이 상태로는 쓸 수 없다.

**권장 조치**: `SYSTEM_DIRECT_FLOW`의 selector completeness 규칙을 `intent_parser.SYSTEM_PROMPT`와 동등한 수준으로 개정한 뒤 T-A만 재실행. (10장에 재실행 방법 정리)

---

## 2. 전체 지표 비교

| 지표 | T-A | T-B | T-C | T-D |
|---|---|---|---|---|
| schema_validity | 0.994 | 0.954 | 0.983 | 0.989 |
| status_match | **0.183**⚠️ | 0.743 | 0.809 | 0.949 |
| false_rejection_rate | **0.953**⚠️ | 0.267 | 0.173 | 0.047 |
| rejection_recall | 1.000 | 0.800 | 0.700 | 0.920 |
| rejection_reason_match | 0.600 | 0.850 | 0.914 | 0.957 |
| false_acceptance_rate | 0.000 | 0.180 | 0.300 | 0.060 |
| **NEM** | N/A (포맷 상이) | 0.164 | 0.149 | **0.692** |
| hallucinated_entity_rate | N/A | 0.004 | 0.001 | 0.000 |

⚠️ T-A 수치는 1장의 프롬프트 결함 때문에 신뢰 불가 — 표에는 참고용으로만 남김.

T-B와 T-C를 비교하면 흥미로운 패턴이 나온다: **few-shot을 추가하니 status_match(accept/reject 판별)는 좋아졌는데(0.743→0.809) NEM(전체 슬롯 완전 일치)은 오히려 살짝 떨어졌다(0.164→0.149).** 즉 few-shot 데모가 "받아들일지 말지" 판단에는 도움을 줬지만, 슬롯 값 자체의 정확도(특히 IP)에는 거의 기여하지 못했다 — grounding 없이는 few-shot 예시만으로 호스트→IP 매핑을 배우기 어렵다는 뜻으로 해석된다.

---

## 3. 슬롯 정확도 비교 (T-B/C/D만 — T-A는 IntentIR 슬롯 없음)

| 슬롯 | T-B | T-C | T-D | Grounding 효과(T-D−T-C) |
|---|---|---|---|---|
| protocol | 1.000 | 0.967 | 1.000 | +0.033 |
| action | 0.932 | 0.935 | 0.965 | +0.030 |
| dst_port | 0.636 | 0.951 | 0.968 | +0.017 |
| queue / min_bw / max_latency | ~1.000 | ~0.99 | 1.000 | ~0 |
| device | 0.552 | 0.595 | 0.819 | **+0.224** |
| egress_port | 0.430 | 0.469 | 0.835 | **+0.366** |
| **source_ip** | 0.107 | 0.094 | 0.908 | **+0.814** |
| **destination_ip** | 0.150 | 0.137 | 0.908 | **+0.771** |
| waypoints | 0.500 | 0.595 | 0.542 | -0.053 |
| alt_egress_port | 0.000 | 0.027 | 0.292 | +0.265 |

**Grounding의 효과는 IP 슬롯에서 압도적으로 드러난다.** source_ip/destination_ip가 grounding 없이는(T-B/C) 10~15%대에 머물다가 grounding을 켜자(T-D) 90%대로 뛴다 — 이건 당연한 결과이기도 하다(호스트 이름 h1을 10.0.0.1로 바꾸는 alias 매핑이 grounding 프롬프트에 있으니까). 반면 few-shot만으로는(T-B→T-C) 이 슬롯이 거의 개선되지 않는다(0.107→0.094, 사실상 그대로) — **few-shot 예시 몇 개로는 host↔IP 매핑을 일반화해서 배우지 못하고, 명시적 grounding 인벤토리가 있어야만 해결된다**는 걸 보여준다. 이는 논문의 핵심 설계 논지(IR + grounding + 결정론적 컴파일러 구조의 필요성)를 강하게 뒷받침하는 근거다.

waypoints만 유일하게 grounding 후 소폭 하락(-0.053)했는데, 이는 앞선 T-D 단독 보고서(`T-D_openrouter_result.md` 5장)에서 이미 확인한 SFC 카테고리 고유의 난이도(특히 s2 IDS 그라운딩 결함) 때문으로 보인다.

---

## 4. 카테고리별 NEM 비교 (T-B/C/D)

| 카테고리 | T-B | T-C | T-D |
|---|---|---|---|
| security | 0.400 | 0.280 | 0.900 |
| forwarding | 0.290 | 0.256 | 0.837 |
| compound | 0.148 | 0.100 | 0.844 |
| reroute | 0.140 | 0.140 | 0.580 |
| qos | 0.111 | 0.062 | 0.841 |
| sfc | 0.000 | 0.000 | 0.167 |

모든 카테고리에서 grounding 도입(T-C→T-D) 시점에 큰 폭으로 뛴다. 특히 sfc는 T-B/T-C에서 **0.000**(단 한 건도 완전히 못 맞춤)이었다가 T-D에서 0.167로 오르는데, 이 자체가 이미 "grounding 없이는 SFC를 하나도 못 푼다"는 강한 신호다.

---

## 5. 실행 오류 (참고)

| Treatment | error_kind=null | schema_invalid | transport | 수동 보강 |
|---|---|---|---|---|
| T-A | 348 | 2 | 0 | G-SFC-034 (프로세스 중단 후 보강) |
| T-B | 334 | 16 | 0 | 없음 |
| T-C | 344 | 6 | 0 | G-SFC-035 (프로세스 중단 후 보강) |
| T-D | 346 | 4 | 0 | 없음 |

T-A/T-C 각각 마지막 1케이스(둘 다 SFC 카테고리)에서 프로세스가 죽어 수동으로 별도 호출해 보강했다 — 4개 run 전부 350/350 확보됨, `transport` 에러는 전체 통틀어 0건.

---

## 6. 다음 단계

1. **[우선순위 최상] T-A 프롬프트 수정 후 재실행** — `SYSTEM_DIRECT_FLOW`의 selector completeness 규칙을 `intent_parser.SYSTEM_PROMPT`와 동등하게 개정(1장). 재실행 전엔 T-A vs T-B 비교(IR의 순수 기여, 논문 핵심 주장)를 논문에 쓸 수 없음.
2. T-A/T-C에서 SFC 카테고리 케이스 처리 중 프로세스가 반복적으로 죽는 패턴(2회 연속 발생) — 원인 조사 필요. 극단적으로 긴 thinking(이전 T-D 단독 분석에서 최대 150초/14K 토큰 관측)이 타임아웃이나 다른 자원 문제를 유발할 가능성.
3. n=1 rep 결과이므로 최소 3 rep 이상 확보해 재현성 확인 필요 — 특히 T-B vs T-C의 NEM 역전(0.164→0.149)이 실제 효과인지 샘플링 노이즈인지 구분 필요.
4. `T-D_openrouter_result.md`에서 이미 지적된 QoS "enforcement device 미명시" 과잉거부, `topology_eval.json`의 s2 IDS 그라운딩 결함은 T-B/C/D 전체에 걸쳐 있을 가능성이 높음 — 별도 조치 검토.
