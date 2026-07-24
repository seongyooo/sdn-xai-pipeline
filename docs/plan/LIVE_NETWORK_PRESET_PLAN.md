# 구현 계획 — 네트워크 프리셋 + 실시간 모니터링

> 작성: 2026-07-23
> 상위 문서: [NETWORK_STATE_EXPERIMENT_PLAN.md](NETWORK_STATE_EXPERIMENT_PLAN.md) (Track B의 "왜")
> 이 문서는 Track B의 "어떻게" — 실제로 무엇을 코드로 만드는지에 대한 구현 계획이다.

---

## 0. 목표를 한 문장으로

**"네트워크 프리셋을 적용하면, 특정 상황(예: 코어 링크 혼잡)이 실제로 재현된 네트워크가 그 순간부터 계속 돌아가고, 운영자는 링크별 대역폭·혼잡 위치·드롭률·큐 백로그를 실시간으로 보면서, 필요하면 그 자리에서 바로 정책(FlowRule)을 적용할 수 있다."**

이건 지금까지의 파이프라인과 실행 모델이 다르다는 점이 중요하다.

| | 기존 (Stage 1~6) | 신규 (네트워크 프리셋) |
|---|---|---|
| 실행 방식 | 요청 1건 → 검증 → 배포 → **즉시 종료** | 프리셋 적용 → **계속 실행**되는 세션 → 그 안에서 여러 번 관찰/적용 |
| Digital Twin 수명 | `verify()` 안에서 시작→검증→**rollback→net.stop()** (1회성) | 세션이 살아있는 동안 유지, 명시적으로 멈출 때까지 지속 |
| 모니터링 | 없음 (Twin 검증 중 iperf 배지만 일시적) | 상시 — 프리셋이 살아있는 한 계속 |

---

## 1. 기존 자산 재사용 맵 (새로 만들 필요 없는 것)

조사해보니 생각보다 이미 많이 있다.

| 필요한 것 | 이미 있는 것 | 위치 |
|---|---|---|
| 현실적인 토폴로지 | **10개 프리셋** — diamond/linear/ring/spine-leaf/fat-tree/tree/full-mesh/campus/wan/**clos-fabric**(14SW·10H, 5-tier, dual-homed host 포함) | `static/app.js` `TOPOLOGY_PRESETS` |
| 대역폭 제한 링크 | `TCLink(bw=...)`로 이미 커널 tc/HTB 레벨 제한 적용됨 | `stage4_twin/topology.py` |
| 트래픽 발생/측정 | `_iperf_check()` (iperf3, iperf v2 폴백) | `stage4_twin/twin_verifier.py` |
| 포트 통계 API | `port_statistics()` | `stage4_twin/onos_client.py` |
| 실시간 스트리밍 패턴 | SSE (`/api/run`), `onTwinBw` 핸들러 + 대역폭 배지 UI | `api.py`, `static/app.js` |
| 커스텀 토폴로지 적용 흐름 | `POST /api/topology/custom` → `POST /api/topology/apply`(ONOS netcfg push) | `api.py` |

**새로 만들어야 하는 것 4가지**만 이 문서의 범위다: ① 트래픽 프리셋 정의, ② 배경 트래픽 생성기, ③ 지속 세션(Live Session) 관리자, ④ 상시 모니터링 수집·스트리밍.

---

## 2. 토폴로지 선택

**메인 데모: `clos-fabric` 프리셋을 그대로 재사용.** 이미 존재하고, 실제로 오버서브스크립션 지점이 있다:

- **Aggregation→Egress** (`s12→s14`, `s13→s14`, 각 10Mbps, 합 20Mbps)가 h2(egress 호스트, 100Mbps 링크) 쪽으로 좁아지는 구조 — 여러 호스트(h1/h6/h7/h10 등)가 동시에 h2로 트래픽을 보내면 이 두 링크에서 진짜 병목이 생긴다.
- 이미 DPID hex 버그가 수정된 상태([docs/sessions/2026-07-23-dpid-debug.md](../sessions/2026-07-23-dpid-debug.md))라 s10~s14도 정상 동작 확인됨.

**보조: `diamond`** — 지금처럼 단위 테스트/디버깅용 최소 재현 케이스로 유지. 링크 2개(1Mbps/10Mbps)뿐이라 "혼잡 vs 우회 경로"를 가장 빨리 눈으로 확인할 수 있다.

Small 커스텀 토폴로지를 새로 그릴 필요는 없다고 판단한다 — 이미 있는 자산으로 충분하고, 새 토폴로지를 그리는 시간을 트래픽 프리셋/모니터링 구현에 쓰는 게 낫다.

---

## 3. 트래픽 프리셋 — 데이터 포맷

토폴로지 프리셋과 별개의 개념이다. **하나의 트래픽 프리셋은 특정 토폴로지 프리셋을 전제로, 그 안에서 동시에 흐를 배경 flow들을 정의한다.**

```jsonc
// data/traffic_presets/clos-fabric_core-congestion.json
{
  "id": "clos-fabric_core-congestion",
  "label": "코어 혼잡 — 다수 호스트가 h2로 동시 스트리밍",
  "topology_id": "clos-fabric",          // 이 프리셋이 전제하는 토폴로지 프리셋
  "flows": [
    {
      "id": "f1", "src": "h1", "dst": "h2",
      "proto": "tcp", "target_mbps": 8,
      "pattern": "constant",              // constant | ramp | bursty
      "start_offset_sec": 0, "duration_sec": null   // null = 세션 종료까지 지속
    },
    {
      "id": "f2", "src": "h7", "dst": "h2",
      "proto": "tcp", "target_mbps": 8,
      "pattern": "constant",
      "start_offset_sec": 0, "duration_sec": null
    },
    {
      "id": "f3", "src": "h10", "dst": "h2",
      "proto": "udp", "target_mbps": 6,
      "pattern": "bursty",                 // 10초 on / 5초 off 반복 (구현 시 파라미터화)
      "start_offset_sec": 10, "duration_sec": null
    }
  ]
}
```

f1+f2가 이미 8+8=16Mbps로 `s12→s14`/`s13→s14`(각 10Mbps, 합 20Mbps) 용량의 80%를 채우고, f3가 10초 뒤 추가되면 20Mbps를 넘겨 실제로 드롭이 발생하는 시나리오다.

### 제안 프리셋 목록 (clos-fabric 기준)

| 프리셋 | 시나리오 | 목적 |
|---|---|---|
| `idle` | 배경 트래픽 없음 | false-positive 혼잡 탐지 방지 확인용 베이스라인 |
| `core-congestion` | 위 예시 — Aggregation→Egress 포화 | 핵심 데모: 혼잡 발생 → 탐지 → (나중에 Track B 추천) |
| `ramping-load` | 트래픽이 서서히 증가 (0→15Mbps, 60초에 걸쳐) | "혼잡이 서서히 심해지는" 그래프를 실시간으로 보여주는 용도 |
| `bursty-single-link` | 한 링크(예: `s1→s5`)에만 짧은 버스트 반복 | 순간 혼잡 vs 지속 혼잡 구분 시연 |
| `dual-homed-failover` | h4/h5(dual-homed)로 가는 트래픽 중 한쪽 업링크만 부하 | 이중화 경로 활용 시나리오 (reroute 추천과 직결) |

diamond용으로는 `diamond_slow-path-saturation`(1Mbps 저속 경로를 h2↔h3 트래픽으로 채우는) 하나만 있으면 충분.

---

## 4. 배경 트래픽 생성기 (`pipeline/stage4_twin/traffic_generator.py`, 신규)

**설계 원칙**: 기존 `_iperf_check()`는 "1회 측정 후 종료"(`-1` 플래그, foreground, blocking)라 목적이 다르다. 이건 "세션이 끝날 때까지 계속 도는 백그라운드 부하"가 필요하므로 별도 모듈로 분리한다.

```python
@dataclass
class TrafficFlowHandle:
    flow_id: str
    src_host: str
    dst_host: str
    server_pid: Optional[int] = None
    client_started_at: float = 0.0

def start_traffic_preset(net, preset: dict) -> list[TrafficFlowHandle]:
    """
    preset["flows"] 각각에 대해:
      1. dst_host에서 iperf3 서버 백그라운드 기동 (sendCmd, non-blocking)
      2. start_offset_sec만큼 지연 후 src_host에서 iperf3 클라이언트 기동
         - pattern="constant": -b {target_mbps}M -t {duration or 매우 긴 값} (background)
         - pattern="bursty":   on/off 루프를 쉘 스크립트로 감싸서 background 실행
         - pattern="ramp":     여러 단계로 -b 값을 증가시키며 재시작 (또는 tc 자체를 동적 조절)
      3. TrafficFlowHandle 리스트 반환 (정리용 PID/호스트 추적)
    """

def stop_traffic_preset(net, handles: list[TrafficFlowHandle]) -> None:
    """각 flow의 src/dst 호스트에서 pkill iperf3. 세션 종료 시 반드시 호출."""
```

**주의할 구현 디테일:**
- Mininet `host.cmd("... &")`로 백그라운드 실행 시 PID 추적이 안 되면 좀비 프로세스가 남는다 — `cmd(f"... & echo $!")`로 PID를 받아 `stop_traffic_preset`에서 `kill -9`로 확실히 정리해야 한다 (twin_verifier가 `finally`에서 항상 `mn -c`로 인터페이스 정리하는 것과 같은 이유).
- `duration_sec: null`(무기한)인 flow는 iperf3 `-t 0`(무제한) 또는 매우 큰 값 + 세션 종료 시 강제 kill로 처리.
- `bursty`/`ramp` 패턴은 iperf3 단일 호출로 못 만든다 — 호스트에서 실행할 쉘 루프 스크립트를 만들어 백그라운드로 던지는 방식을 권장 (예: `while true; do iperf3 -c $DST -b 6M -t 10; sleep 5; done &`).

---

## 5. 지속 세션 관리자 (`pipeline/stage4_twin/live_session.py`, 신규) — 가장 중요한 설계 결정

기존 `TwinVerifier.verify()`는 "시작→검증→**항상 rollback+net.stop()**"이 하나로 묶여 있다(`finally` 블록). 이 구조를 건드리지 않고, **별도의 세션 관리자**를 새로 만드는 걸 권장한다 — 이유는 이미 잘 동작하고 테스트된 1회성 검증 로직(기존 파이프라인의 Stage 4)을 건드릴 이유가 없기 때문이다.

```python
class LiveNetworkSession:
    """프리셋 적용 → 계속 실행 → 명시적 종료. TwinVerifier와 별개의 생명주기."""

    def __init__(self):
        self.net = None
        self.client: Optional[OnosClient] = None
        self.traffic_handles: list[TrafficFlowHandle] = []
        self.monitor_task: Optional[asyncio.Task] = None
        self.status: str = "idle"  # idle | starting | running | stopping

    def start(self, topology_preset: dict, traffic_preset: Optional[dict]) -> None:
        """토폴로지 기동 + ONOS 연결 대기 + (있으면) 배경 트래픽 시작 + 모니터링 루프 시작.
        net.stop()을 호출하지 않는다 — stop()이 명시적으로 불릴 때까지 계속 실행."""

    def stop(self) -> None:
        """배경 트래픽 정리 → 모니터링 루프 중단 → net.stop() → mn -c."""

    def snapshot(self) -> dict:
        """현재 링크별 utilization/rtt/loss 스냅샷 (모니터링 수집기가 채움)."""
```

**기존 파이프라인과의 연결점 — 결정됨 (2026-07-23):**
세션이 `running` 상태일 때 운영자가 정책을 적용하는 방식은 **"지금 네트워크 상황에 새 FlowRule을 바로 적용"**으로 확정했다. 즉:

- Stage 1→2→3(파싱/컴파일/정적검증)은 그대로 거친다 — 결정론적이고 빠르므로 스킵할 이유가 없다.
- **Stage 4(Digital Twin)는 스킵한다.** 별도의 rollback-검증용 임시 환경을 또 띄우지 않는다 — 이미 실시간으로 관찰 중인 살아있는 네트워크 자체가 검증 대상이기 때문에, "적용 후 모니터링 지표 변화를 지켜보는 것"이 곧 검증이다.
- Stage 6 배포가 세션의 `client`(같은 ONOS)로 직접 나가고, **rollback하지 않는다** — 배포된 상태가 곧 "지금 네트워크 상황"이 되므로 그대로 유지된다.
- `TwinVerifier.verify_against_session()` 같은 재사용 메서드는 **만들지 않는다.** API 레벨에서 "세션이 running이면 Stage4를 건너뛰고 세션의 client로 Stage6를 호출"하는 분기만 있으면 된다 — 리팩토링 범위가 훨씬 작다.

---

## 6. 모니터링 수집기 + 스트리밍

### 6-1. 무엇을 잰다

| 지표 | 수집 방법 |
|---|---|
| 링크별 처리량(Mbps) | `onos_client.port_statistics()`를 N초 간격 폴링 → byte counter 델타 / 간격 |
| 링크별 utilization(%) | 처리량 ÷ 해당 링크의 `bw`(토폴로지 프리셋에 정의된 값) |
| 손실/혼잡 품질 | **결정됨 (2026-07-23): `tc qdisc` drop 카운터 기반.** ping은 쓰지 않는다 — end-to-end 경로 전체를 뭉뚱그리기 때문에 정확히 어느 링크에서 버려지는지 특정 못 하는 반면, 링크(=인터페이스) 단위로 `tc -s qdisc show dev <ifname>`을 순회하면 어느 링크가 병목인지 정확히 짚을 수 있다. 각 링크의 스위치 쪽 인터페이스 이름은 `twin_verifier.py`의 `_find_mininet_port()`가 이미 `net.links`에서 `intf1.node.name`/`intf2.node.name`으로 링크→인터페이스를 찾는 로직을 가지고 있으므로 그 방식을 재사용해 인터페이스를 특정하고, `dropped`/`overlimits`(손실) 카운터와 `backlog`(현재 큐에 쌓인 바이트 — 대기 지연의 근사치)를 파싱한다. **주의**: 이건 엄밀한 end-to-end RTT는 아니다 — qdisc는 링크 단위 큐 상태이지 왕복시간이 아니다. "RTT" 대신 "드롭률 + 큐 백로그 기반 지연 근사치"로 명칭/문서를 통일한다. |

### 6-2. 수집 루프

`LiveNetworkSession` 내부에 백그라운드 스레드(or asyncio task)로 N초(예: 2초) 간격 폴링 → `snapshot()`에 최신 상태 유지.

### 6-3. API/스트리밍 설계

```
POST /api/network-preset/apply
  body: {"topology_id": "clos-fabric", "traffic_preset_id": "core-congestion"}
  → LiveNetworkSession.start(), 202 Accepted (기동에 시간 걸림 — Mininet 기동은 twin_verifier 기준 실측 필요)

GET  /api/network-preset/stream   (SSE)
  → 2초 간격으로 {"type": "link_stats", "links": [{"id": "l44", "mbps": 9.2, "util_pct": 92, "dropped": 12, "backlog_bytes": 4096}, ...]}

POST /api/network-preset/stop
  → LiveNetworkSession.stop()

GET  /api/network-preset/status
  → {"status": "running", "topology_id": ..., "traffic_preset_id": ..., "started_at": ...}
```

기존 `dependencies=[Depends(_require_api_key)]` 패턴을 그대로 적용(쓰기 엔드포인트이므로).

### 6-4. 프론트엔드

- 사이드바에 "네트워크 프리셋" 섹션 신규: 토폴로지 프리셋 선택(기존 드롭다운 재사용) + 트래픽 프리셋 선택(신규 드롭다운) + "적용" 버튼.
- 토폴로지 뷰의 링크 렌더링에 utilization 기반 색상 그라데이션 적용 — 기존 `onTwinBw` 핸들러/배지 로직을 "Twin 검증 중에만"이 아니라 "네트워크 프리셋 스트림 수신 중이면 항상"으로 확장.
- 링크 hover 시 드롭률/큐 백로그 툴팁 추가.
- 기존 인텐트 실행 UI ("Run" 버튼)는 그대로 두되, 세션이 `running`이면 실행 결과가 "새 Twin이 아니라 지금 보고 있는 이 네트워크에 적용됨"을 배너로 명시.

---

## 7. 구현 순서 (사용자가 원한 순서 그대로 — 생성기부터)

| 순서 | 작업 | 산출물 |
|---|---|---|
| 1 | 트래픽 프리셋 JSON 포맷 확정 + `data/traffic_presets/` 2~3개 작성 (clos-fabric core-congestion, diamond slow-path) | 3장 |
| 2 | **배경 트래픽 생성기** `traffic_generator.py` (start/stop, constant 패턴만 먼저) | 4장 |
| 3 | 독립 실행 스크립트로 수동 검증: Mininet 띄우고 프리셋 적용 → `ovs-ofctl dump-ports`로 눈으로 부하 확인 | — |
| 4 | 모니터링 수집기 (port_statistics 폴링 + `tc qdisc` drop/backlog 파싱) — 우선 CLI에서 print로 확인 | 6-1, 6-2 |
| 5 | `LiveNetworkSession` 관리자(단일 세션) + API 3종(apply/stream/stop) | 5장, 6-3 |
| 6 | 프론트엔드 프리셋 선택 UI + 실시간 링크 시각화 | 6-4 |
| 7 | bursty/ramp 패턴 추가, 프리셋 목록 확충 | 3장 |
| 8 | 세션 running 시 Stage4 스킵 + Stage6 직접 배포 분기 (API 레벨) | 5장 마지막 단락 |

1~5까지가 "모니터링 가능한 살아있는 네트워크"라는 핵심 요구사항의 최소 완성 단위다. 6~8은 UX 완성도/정책 연동이다.

---

## 8. 열린 질문

> 2026-07-23 업데이트: 아래 4개 중 3개가 확정됨. 남은 건 폴링 주기 하나뿐.

- ~~세션-파이프라인 통합 방식~~ → **확정**: Stage4 스킵, 세션 client로 Stage6 직접 배포(rollback 없음). 5장 참조.
- ~~RTT/손실률 측정 방법~~ → **확정**: `tc qdisc` drop/backlog 카운터 기반. ping 안 씀. 6-1 참조.
- ~~동시 세션 수~~ → **확정**: 단일 세션만 지원.
- **모니터링 폴링 주기** (미확정) — 2초로 예시를 들었는데, ONOS `statistics/ports` 응답 속도와 Mininet 오버헤드를 실측해서 조정 필요. 구현 순서 4단계(모니터링 수집기)에서 실측 후 확정 권장.

---

## 9. 리스크

- Mininet 백그라운드 프로세스(iperf3 루프) 정리 실패 시 다음 실행에 인터페이스 잔존 문제가 생길 수 있다 — `stop_traffic_preset`이 반드시 `finally`류 보장 경로에서 호출되도록 `LiveNetworkSession.stop()`에 강한 예외 처리 필요 (`twin_verifier.py`의 기존 rollback 패턴 참고).
- 세션이 오래 떠있으면(데모 중 방치 등) iperf3 프로세스가 계속 도는데, 서버 재시작 없이는 회수가 안 됨 — 타임아웃 자동 종료(예: 30분) 고려.
- 남은 미확정 항목(폴링 주기)은 구현 순서 4단계(모니터링 수집기)에서 실측해보고 정하는 걸 권장 — 지금 결정하기엔 실측 데이터가 없다.
