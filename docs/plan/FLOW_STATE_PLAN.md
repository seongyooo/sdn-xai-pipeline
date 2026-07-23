# Flow State 관리 계획

> 작성: 2026-07-23  
> 목적: Digital Twin 검증 품질 전반 개선 — 3가지 축
> 1. FlowRule 누적 상태 관리 (토폴로지별 캐시 + UI)
> 2. 실제 트래픽 경로 추적 (ovs-appctl trace)
> 3. 복수 flow 동시 검증 (concurrent interference test)

---

## 1. 문제 정의

### 현재 구조의 한계

Digital Twin은 매 파이프라인 실행마다 Mininet을 새로 시작하므로 근본적으로 stateless.  
현재 검증 흐름:

```
Mininet 시작 → 기존 ONOS flow 전체 삭제 → 새 rule만 설치 → 검증
```

**문제**: 실제 운영 ONOS에는 이전에 배포된 rule들이 쌓여 있음.  
Digital Twin은 "새 rule만 있는 이상적 환경"을 검증하므로 실제 환경과 괴리.

예시:
```
운영 ONOS 상태: [block s1(h1→h4)] + [forward s2(h2→h3)] + 새 rule [block s3(h1→h3)]
현재 Twin:      새 rule [block s3(h1→h3)] 만 설치 후 검증
올바른 Twin:    3개 rule 모두 설치 후 검증 (기존 rule과 간섭 있는지도 확인)
```

### Mininet 재시작은 불가피한가?

Mininet 프로세스를 유지하면서 재사용하는 방향도 이론상 가능하지만:
- ONOS 컨트롤러 연결 상태 관리 복잡도가 매우 높음
- Mininet 종료 없이 flow 누적 → 이전 테스트 잔여 상태와 혼합될 위험
- **결론: Mininet 재시작은 유지하되, 시작 시 이전 state를 재현하는 방식으로 해결**

---

## 2. 설계 방향

### 핵심 아이디어: FlowRule 캐시 + 사용자 명시적 로드

캐시 로드를 파이프라인 내부에서 자동으로 하지 않음.  
**사용자가 "0단계" 버튼으로 명시적으로 불러온 뒤 파이프라인을 실행.**

```
┌─────────────────────────────────────────────┐
│  파이프라인 성공 (APPROVE + Deploy 완료)      │
│  → 새 FlowRule을 토폴로지별 캐시에 추가 저장  │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
        data/flow_state/{topology_id}.json
        {
          "topology_id": "clos-fabric",
          "flows": [...],   ← 누적된 FlowRule 목록
          "updated_at": "2026-07-23T..."
        }
                       │
          사용자가 "Load State" 버튼 클릭
                       │
                       ▼
        preloadedFlows[] (프론트엔드 메모리)
        + UI에 로드된 flow 목록 표시
                       │
          Run Pipeline 클릭
                       │
                       ▼
┌─────────────────────────────────────────────┐
│  Stage 4 (Digital Twin)                     │
│  preloadedFlows (파라미터로 전달)            │
│  + new_flows 모두 설치                      │
│  → 파이프라인은 새 rule만 검증               │
│     (기존 flow는 환경 세팅 용도)             │
└─────────────────────────────────────────────┘
```

**핵심 원칙**:
- 파이프라인(Stage 1~6)은 항상 **새 rule 하나만** 처리
- 캐시 state는 Twin의 "배경 환경"을 구성하는 용도
- 사용자가 명시적으로 Load 해야만 적용됨 → 의도치 않은 state 누적 방지

---

## 3. 토폴로지 ID 체계

토폴로지마다 독립적인 state를 유지하려면 안정적인 ID가 필요.

| 토폴로지 종류 | ID 결정 방식 | 예시 |
|---|---|---|
| 프리셋 (diamond 등) | 프리셋 키 그대로 | `"diamond"`, `"clos-fabric"` |
| 커스텀 (custom_topology.json) | 파일명 고정 | `"custom"` |
| ONOS 라이브 | ONOS 연결 시 `"onos-live"` 고정 | `"onos-live"` |

파이프라인 실행 시 어떤 토폴로지를 사용 중인지는 이미 `api.py`에서 결정됨.  
이 정보를 각 stage에 `topology_id` 파라미터로 전달.

---

## 4. 구현 컴포넌트

### 4-1. `pipeline/flow_state_manager.py` (신규)

토폴로지별 FlowRule 상태를 `data/flow_state/` 디렉토리에 JSON으로 관리.

```python
FLOW_STATE_DIR = Path("data/flow_state")

def load_state(topology_id: str) -> list[dict]:
    """저장된 FlowRule 목록 반환. 없으면 []."""

def save_flows(topology_id: str, new_flows: list[dict]) -> None:
    """기존 state에 new_flows 추가 저장 (누적)."""

def clear_state(topology_id: str) -> None:
    """해당 토폴로지의 state 파일 삭제."""

def list_states() -> dict[str, dict]:
    """모든 토폴로지의 state 요약 반환 {topology_id: {count, updated_at}}."""
```

저장 형식 (`data/flow_state/clos-fabric.json`):
```json
{
  "topology_id": "clos-fabric",
  "flows": [
    {
      "deviceId": "of:0000000000000005",
      "priority": 50000,
      "selector": {"criteria": [...]},
      "treatment": {"instructions": [{"type": "NOACTION"}]},
      "_meta": {
        "intent": "block h1→h2 on s5",
        "deployed_at": "2026-07-23T14:30:00"
      }
    }
  ],
  "updated_at": "2026-07-23T14:30:00"
}
```

`_meta` 필드는 UI 표시용 (어떤 인텐트로 설치된 rule인지).

---

### 4-2. `twin_verifier.py` 변경

`preloaded_flows` 파라미터를 추가로 받음. 파이프라인 내부에서는 캐시를 직접 읽지 않음.

```python
# 기존
client.clear_app_flows()
client.deploy_flow_rules({"flows": new_flows})

# 변경 후
# preloaded_flows: 사용자가 UI에서 Load한 이전 state (없으면 [])
self._log(f"② 사전 로드된 FlowRule: {len(preloaded_flows)}개")

client.clear_app_flows()
all_flows = _strip_meta(preloaded_flows) + new_flows
client.deploy_flow_rules({"flows": all_flows})
```

**검증 범위**:
- `new_flows`에 대한 intent 검증만 수행 (파이프라인 본연의 역할)
- `preloaded_flows`는 환경 구성 용도 — 간섭 테스트 대상에는 포함 (10-2절)

---

### 4-3. `api.py` 변경

#### Stage 6 성공 후 state 저장

```python
if deploy_ok:
    flow_state_manager.save_flows(
        topology_id=current_topology_id,
        new_flows=flowrule["flows"],
    )
```

**중요**: Twin 검증 성공 + ONOS 실제 배포 성공 시에만 저장.

#### `/api/run` 요청에 `preloaded_flows` 파라미터 추가

```python
class RunRequest(BaseModel):
    intent: str
    ...
    preloaded_flows: list[dict] = []   # ← 신규: UI에서 Load State 후 전달
```

Twin 단계에서 `preloaded_flows`를 `twin_verifier.verify()`에 그대로 전달.

---

### 4-4. API 엔드포인트 (신규)

```
GET    /api/flow-state                          → 모든 토폴로지 state 목록
GET    /api/flow-state/{topology_id}            → 특정 토폴로지 flows + sync_status
DELETE /api/flow-state/{topology_id}            → 전체 초기화
DELETE /api/flow-state/{topology_id}/flows/{i} → 개별 rule 삭제 + ONOS 동시 제거
```

---

### 4-5. UI 변경

#### Step 0 — "Load State" 버튼 (신규)

파이프라인 영역 상단 (pipeline-progress 위) 또는 intent 입력창 옆에 배치.

```
┌─────────────────────────────────────────┐
│  [⬇ Load State  ●3]   [✕ Clear]        │
│  clos-fabric · 3 rules · 2026-07-23     │
│  ┌──────────────────────────────────┐   │
│  │ s5 | 50000 | h1→h2 | DROP   [✕] │   │
│  │ s8 | 50000 | h1→h2 | DROP   [✕] │   │
│  │ s3 | 50000 | h1→h2 | DROP   [✕] │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

동작:
1. `GET /api/flow-state/{topology_id}` 호출
2. 불일치 배너 표시 (있을 경우)
3. `preloadedFlows[]` 프론트엔드 변수에 저장
4. 로드된 flow 목록 카드로 표시
5. Run Pipeline 클릭 시 `preloaded_flows`를 `/api/run` body에 포함

**상태 표시**:
- 로드 안 됨: 버튼만 표시 (`[⬇ Load State]`)
- 로드됨: `[⬇ Loaded ●3]` + 목록 카드 표시
- 캐시 없음: `저장된 state 없음` 메시지

#### FLOW RULES 섹션 개편 (토폴로지 패널 하단)

현재: ONOS 라이브 flow만 표시  
변경: **탭 구조**로 분리

```
FLOW RULES  [ONOS Live] [Saved State ●3]
```

| 탭 | 내용 |
|---|---|
| **ONOS Live** | 현재 ONOS에 설치된 flow (기존 polling 유지) |
| **Saved State** | 캐시 파일의 누적 flow 목록 (Load State와 동기화) |

Saved State 탭:
- flow 목록 (Device / Pri / Match / Action / Intent / 날짜)
- 개별 `✕` 삭제 버튼
- 전체 초기화 버튼
- 불일치 배너 (ONOS Live와 비교)

---

## 5. 데이터 흐름

```
[파이프라인 실행]
  Stage 1 → Stage 2 → Stage 3
    ↓
  Stage 4 (Digital Twin)
    ① flow_state_manager.load_state(topology_id)  → existing_flows (캐시)
    ② Mininet 시작
    ③ existing_flows + new_flows 모두 설치
    ④ 기존 flow regression 확인 (확장)
    ⑤ 새 flow intent 검증
    ↓
  Stage 5 (XAI) → APPROVE
    ↓
  Stage 6 (ONOS Deploy)
    ⑥ ONOS에 new_flows만 추가 배포 (existing_flows는 이미 있음)
    ⑦ 배포 성공 시 flow_state_manager.save_flows(topology_id, new_flows)
    ↓
  UI: Applied State 탭 업데이트
```

---

## 6. 엣지 케이스 처리

| 상황 | 처리 방식 |
|---|---|
| 캐시된 flow가 현재 ONOS에 없는 경우 | Twin은 캐시 기준으로 설치, 검증 후 ONOS에 재배포 여부는 사용자 판단 |
| 캐시 flow + 새 flow 간 충돌 (Stage 3에서 이미 감지) | Stage 3에서 REJECT 되므로 Stage 4 미진입 |
| 토폴로지 변경 (preset 전환) | 다른 `topology_id` → 독립적인 state 파일 사용 |
| 캐시 초기화 후 재실행 | load_state() → [] → 새 flow만 설치 (기존 동작과 동일) |
| ONOS 배포 skip (toggle on) | state 저장 안 함 (Twin 통과만으로는 저장 없음) |

---

## 7. 구현 순서

### Phase 1 — 백엔드 기반 (우선)
1. `pipeline/flow_state_manager.py` 작성
2. `twin_verifier.py`: `topology_id` 파라미터 추가, 캐시 flow 로드 + 설치
3. `api.py`: Stage 6 성공 후 state 저장, `/api/flow-state` 엔드포인트 추가
4. `data/flow_state/` 디렉토리 생성 (`.gitkeep` 포함)

### Phase 2 — UI
5. `static/app.js`: Applied State 탭 로직 (`fetchFlowState()`, 렌더링)
6. `static/index.html`: FLOW RULES 섹션 탭 구조 추가
7. `static/style.css`: 탭 스타일, 뱃지, 초기화 버튼

### Phase 3 — Twin 검증 확장
8. 트래픽 경로 추적 (`_path_trace_check()`) 구현
9. 복수 flow 동시 간섭 테스트 구현
10. iperf3 임계값 판정 추가 (현재: 측정만, 개선: PASS/FAIL 기준 도입)
11. 기존 캐시 flow regression 확장 (캐시된 flow 수만큼 pair 추가)

---

## 10. Digital Twin 검증 확장 계획

### 10-1. 실제 트래픽 경로 추적 (Path Trace)

#### 현재 한계

ping/iperf는 "도달 여부"만 확인. 패킷이 **어떤 스위치/포트를 경유했는지** 알 수 없음.  
예: reroute intent를 배포했는데 실제로 의도한 경로를 타는지 확인 불가.

#### 구현: `_path_trace_check()`

`ovs-appctl ofproto/trace`를 사용해 OVS가 특정 패킷을 어떻게 처리하는지 추적.

```python
def _path_trace_check(
    self,
    net,
    sw_name: str,
    src_ip: str,
    dst_ip: str,
    in_port: int = 1,
    proto: str = "ip",
) -> tuple[str, str]:
    """
    ovs-appctl ofproto/trace로 패킷 처리 경로 확인.

    Returns:
        (verdict, trace_summary)
        verdict: "drop" | "output:N" | "normal" | "unknown"
    """
    sw_node = net.get(sw_name)
    packet_spec = f"in_port={in_port},{proto},ip_src={src_ip},ip_dst={dst_ip}"
    raw = sw_node.cmd(
        f"ovs-appctl ofproto/trace {sw_name} {packet_spec} 2>/dev/null"
    )
    # "Verdict: drop" 또는 "Verdict: output:2" 파싱
    m = re.search(r"Verdict:\s*(.+)", raw)
    verdict = m.group(1).strip() if m else "unknown"

    # 경유한 flow rule 요약 (flow N 라인)
    flow_hits = re.findall(r"Flow: (.+)", raw)
    summary = f"verdict={verdict}, flow_hits={len(flow_hits)}"
    return verdict, summary
```

#### 활용 시나리오

| intent 유형 | trace 활용 |
|---|---|
| `block` | `verdict == "drop"` 확인 |
| `forward` | `verdict == "output:N"` + 포트 번호 일치 확인 |
| `reroute` | 소스 스위치에서 trace → 의도한 next-hop 포트로 나가는지 확인 |
| `sfc` | waypoint 스위치에서 trace → 체인 순서 확인 |

#### Evidence에 추가

```json
{
  "path_trace_s5": "verdict=drop, flow_hits=1",
  "path_trace_s1": "verdict=output:2, flow_hits=1"
}
```

---

### 10-2. 복수 flow 동시 간섭 테스트 (Concurrent Interference Test)

#### 현재 한계

캐시 flow + 새 flow를 모두 설치한 후, 각 flow를 **순차적으로** 검증.  
하지만 "동시에 여러 트래픽이 흐를 때 간섭이 생기는가"는 검증하지 않음.

예시 문제:
```
캐시 flow: h1→h4 block (s1)
새 flow:   h3→h4 forward (s1)
→ 같은 스위치에서 h1→h4는 drop, h3→h4는 forward가 동시에 맞게 동작하는가?
```

#### 구현: `_concurrent_interference_test()`

설치된 모든 flow pair에 대해 동시에 ping을 전송하고 각 결과를 확인.

```python
def _concurrent_interference_test(
    self,
    net,
    test_pairs: list[dict],
    # [{"src": "h1", "dst": "10.0.0.4", "expect_reach": False},
    #  {"src": "h3", "dst": "10.0.0.4", "expect_reach": True}]
) -> list[tuple[bool, str]]:
    """
    여러 host pair를 동시에 ping → 결과 수집.
    순차 실행과 비교해 간섭 여부 확인.
    """
    # 1. 모든 호스트에 sendCmd() 동시 발행
    for pair in test_pairs:
        src_node = net.get(pair["src"])
        src_node.sendCmd(f"ping -c 3 -W 1 {pair['dst']}")

    # 2. 결과 수집
    results = []
    for pair in test_pairs:
        src_node = net.get(pair["src"])
        output = src_node.waitOutput()
        m = re.search(r"(\d+)% packet loss", output)
        loss = int(m.group(1)) if m else 100
        reachable = (loss == 0)
        ok = (reachable == pair["expect_reach"])
        results.append((ok, f"{pair['src']}→{pair['dst']}: {'도달' if reachable else '차단'} (기대: {'도달' if pair['expect_reach'] else '차단'})"))

    return results
```

#### test_pairs 자동 생성

캐시 state에서 각 flow의 `src_ip`, `dst_ip`, `action`을 읽어 test_pairs 자동 구성:

```python
def _build_interference_pairs(existing_flows, new_flows, ip_to_host):
    pairs = []
    for f in existing_flows + new_flows:
        criteria = f.get("selector", {}).get("criteria", [])
        src_ip = next((c["ip"] for c in criteria if c["type"] == "IPV4_SRC"), None)
        dst_ip = next((c["ip"] for c in criteria if c["type"] == "IPV4_DST"), None)
        is_block = any(i.get("type") == "NOACTION" for i in
                       f.get("treatment", {}).get("instructions", []))
        if src_ip and dst_ip:
            src_host = ip_to_host.get(src_ip.split("/")[0])
            if src_host:
                pairs.append({
                    "src": src_host,
                    "dst": dst_ip.split("/")[0],
                    "expect_reach": not is_block,
                })
    return pairs
```

#### 검증 결과 구조

```json
{
  "interference_test": true,
  "interference_results": [
    {"pair": "h1→10.0.0.4", "ok": true, "msg": "차단 확인됨"},
    {"pair": "h3→10.0.0.4", "ok": true, "msg": "도달 확인됨"}
  ]
}
```

---

### 10-3. iperf3 임계값 판정 (현재 → 개선)

#### 현재 상태

`_iperf_check()`는 Mbps를 측정하지만 PASS/FAIL 판정 기준 없음.  
QoS intent에서 "최소 N Mbps 보장" 검증 불가.

#### 개선: `min_bw_mbps` 파라미터 추가

```python
def _iperf_check(
    self, net, src_host, dst_host, dst_ip,
    duration=3,
    min_bw_mbps: float | None = None,   # ← 신규
) -> tuple[float, str]:
    ...
    bw_mbps = ...  # 기존 측정 로직

    if min_bw_mbps is not None:
        ok = bw_mbps >= min_bw_mbps
        msg = f"{bw_mbps} Mbps ({'≥' if ok else '<'} 목표 {min_bw_mbps} Mbps)"
        return bw_mbps, msg  # 호출부에서 ok 판정
    return bw_mbps, f"{bw_mbps} Mbps"
```

#### QoS intent에서 활용

IntentIR에 `min_bandwidth_mbps` 필드가 이미 존재 (T-D 실험에서 슬롯 정확도 1.000 확인됨).

```python
# twin_verifier.py
if spec_action == "qos" and intent_ok:
    min_bw = spec_flow.get("min_bandwidth_mbps")   # IR에서 추출
    bw_mbps, bw_msg = self._iperf_check(
        net, src_host, dst_host, dst_ip,
        min_bw_mbps=min_bw,
    )
    if min_bw and bw_mbps >= 0:
        bw_ok = bw_mbps >= min_bw
        checks[bw_key] = bw_ok   # ← PASS/FAIL 판정으로 격상
```

---

## 11. 구현 순서 (전체 통합)

### Phase 1 — Flow State 백엔드
1. `pipeline/flow_state_manager.py` 작성
2. `twin_verifier.py`: topology_id + topo_hash, 캐시 로드 + 설치
3. `api.py`: `/api/flow-state` 엔드포인트 4개, Stage 6 저장
4. `data/flow_state/` 디렉토리 생성

### Phase 2 — Flow State UI
5. FLOW RULES 탭 구조 (ONOS Live / Applied State)
6. 개별 삭제 버튼, 불일치 배너, 초기화 버튼

### Phase 3 — Twin 검증 확장
7. `_path_trace_check()` 구현 + Evidence 추가
8. `_concurrent_interference_test()` 구현
9. iperf3 `min_bw_mbps` 임계값 판정 추가
10. 캐시 flow regression 확장

---

## 8. 설계 결정

### 8-1. 개별 flow 삭제 UI ✅ 구현

Applied State 탭에서 각 rule 행 오른쪽에 `✕` 버튼 추가.

```
[s5] 50000 | nw_src=10.0.0.1,nw_dst=10.0.0.2 | DROP  [✕]
[s8] 50000 | nw_src=10.0.0.1,nw_dst=10.0.0.2 | DROP  [✕]
```

삭제 동작:
- `DELETE /api/flow-state/{topology_id}/flows/{flow_index}` 호출
- state 파일에서 해당 rule 제거
- **운영 ONOS에서도 동시 삭제** (ONOS에 해당 flow가 있으면 REST API로 제거)
- 삭제 후 Applied State 탭 즉시 갱신

`flow_state_manager.py`:
```python
def remove_flow(topology_id: str, flow_index: int) -> dict | None:
    """특정 인덱스의 flow 제거. 제거된 flow 반환."""
```

### 8-2. ONOS Live ↔ Applied State 불일치 경고 ✅ 구현

Applied State 탭 상단에 불일치 배너 표시.

불일치 유형:

| 상황 | 메시지 |
|---|---|
| 캐시에는 있는데 ONOS에 없음 | ⚠ `N개 rule이 ONOS에 미설치 상태 (재배포 필요)` |
| ONOS에는 있는데 캐시에 없음 | ℹ `N개 외부 rule 감지 (다른 경로로 설치됨)` |
| 완전 일치 | 배너 없음 |

비교 기준: `deviceId` + `priority` + selector criteria 해시.

`GET /api/flow-state/{topology_id}` 응답에 불일치 정보 포함:
```json
{
  "flows": [...],
  "sync_status": {
    "in_cache_not_onos": 2,
    "in_onos_not_cache": 0,
    "matched": 5
  }
}
```

UI에서 ONOS Live 폴링 시 (`/api/topology`) state도 함께 비교하여 뱃지 업데이트.

### 8-3. 토폴로지별 독립 캐시 + 구조 변경 시 자동 무효화 ✅ 구현

#### 토폴로지별 독립 캐시

각 토폴로지 ID마다 완전히 독립적인 state 파일 유지.  
프리셋 전환 시 이전 토폴로지 state에 영향 없음.

```
data/flow_state/
├── diamond.json
├── clos-fabric.json
├── spine-leaf.json
└── custom.json
```

#### 커스텀 토폴로지 구조 변경 시 자동 무효화

커스텀 토폴로지(`custom_topology.json`)가 수정되면 기존 캐시의 `deviceId`가 틀릴 수 있음.

**무효화 조건**: `custom.json` state 파일에 토폴로지 구조 해시를 함께 저장.

```json
{
  "topology_id": "custom",
  "topo_hash": "a3f8c2d1",   ← custom_topology.json의 switches/links 해시
  "flows": [...],
  "updated_at": "..."
}
```

파이프라인 실행 시 현재 `custom_topology.json` 해시와 비교:
- 일치 → 캐시 정상 사용
- 불일치 → 캐시 무효화 (flows=[] 로 취급) + UI에 경고 표시

```python
def load_state(topology_id: str, topo_hash: str | None = None) -> list[dict]:
    state = _read_file(topology_id)
    if topo_hash and state.get("topo_hash") != topo_hash:
        # 토폴로지 구조 변경 감지 → 캐시 무효화
        logger.warning(f"[FlowState] {topology_id} 토폴로지 구조 변경 감지 — 캐시 무효화")
        return []
    return state.get("flows", [])

def _compute_topo_hash(custom_data: dict) -> str:
    """switches + links 구조만 해싱 (x/y 좌표 제외)"""
    key = {
        "switches": [{"id": s["id"], "dpid": s["dpid"]} for s in custom_data.get("switches", [])],
        "links": [{"source": l["source"], "target": l["target"]} for l in custom_data.get("links", [])],
    }
    return hashlib.md5(json.dumps(key, sort_keys=True).encode()).hexdigest()[:8]
```

프리셋 토폴로지는 구조가 코드에 고정되어 있으므로 해시 불일치 없음.

---

## 9. 파일 변경 목록 (예상)

| 파일 | 변경 내용 |
|---|---|
| `pipeline/flow_state_manager.py` | **신규** — load/save/remove/clear/list_states, topo_hash 무효화 |
| `pipeline/stage4_twin/twin_verifier.py` | topology_id+topo_hash, 캐시 로드, `_path_trace_check()`, `_concurrent_interference_test()`, iperf 임계값 |
| `api.py` | topology_id 결정 로직, `/api/flow-state` 엔드포인트 4개, Stage 6 저장 |
| `data/flow_state/.gitkeep` | **신규** — 디렉토리 생성 |
| `static/index.html` | FLOW RULES 섹션 탭 구조 (ONOS Live / Applied State) |
| `static/app.js` | Applied State 탭, fetchFlowState(), 개별 삭제, 불일치 배너, 초기화 |
| `static/style.css` | 탭, 불일치 배너, ✕ 버튼, 뱃지 스타일 |

### API 엔드포인트 상세

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/flow-state` | 전체 토폴로지 state 목록 (count, updated_at) |
| `GET` | `/api/flow-state/{topology_id}` | 특정 토폴로지 flows + sync_status |
| `DELETE` | `/api/flow-state/{topology_id}` | 전체 초기화 |
| `DELETE` | `/api/flow-state/{topology_id}/flows/{index}` | 개별 rule 삭제 + ONOS 동시 제거 |
