"""
stage4_twin/twin_verifier.py — Digital Twin 기반 FlowRule 검증

Mininet 가상 네트워크를 사용해 FlowRule이 의도한 동작을 수행하는지
실제로 배포하고 테스트한다.

실행 조건:
  - Linux 플랫폼
  - root 권한 (sudo)
  - Mininet 설치됨

위 조건을 충족하지 못하면 status="skipped"로 반환한다.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Optional

# ── 스티어링 헬퍼 ────────────────────────────────────────────────────────────────
_STEERING_COOKIE = "0xdeadbeef"


def _device_id_to_sw_name(device_id: str, custom_data: Optional[dict]) -> Optional[str]:
    """'of:0000000000000002' → 's2' (커스텀 토폴로지 기반, 없으면 숫자 변환)"""
    if custom_data:
        for sw in custom_data.get("switches", []):
            if f"of:{sw.get('dpid', '')}" == device_id:
                return sw["id"]
    try:
        n = int(device_id.replace("of:", ""), 16)
        return f"s{n}"
    except ValueError:
        return None


def _find_host_switch(host_id: str, custom_data: Optional[dict]) -> Optional[str]:
    """host_id가 직접 연결된 스위치 이름 반환"""
    if not custom_data:
        return None
    sw_ids = {sw["id"] for sw in custom_data.get("switches", [])}
    for lnk in custom_data.get("links", []):
        s, t = lnk["source"], lnk["target"]
        if s == host_id and t in sw_ids:
            return t
        if t == host_id and s in sw_ids:
            return s
    return None


def _bfs_sw_path(src_sw: str, dst_sw: str, custom_data: dict) -> list[str]:
    """BFS로 스위치 간 최단 경로 반환 (스위치 이름 리스트)"""
    sw_ids = {sw["id"] for sw in custom_data.get("switches", [])}
    adj: dict[str, list[str]] = {s: [] for s in sw_ids}
    for lnk in custom_data.get("links", []):
        s, t = lnk["source"], lnk["target"]
        if s in sw_ids and t in sw_ids:
            adj[s].append(t)
            adj[t].append(s)
    q: deque[list[str]] = deque([[src_sw]])
    visited = {src_sw}
    while q:
        path = q.popleft()
        if path[-1] == dst_sw:
            return path
        for nb in adj.get(path[-1], []):
            if nb not in visited:
                visited.add(nb)
                q.append(path + [nb])
    return []


def _find_mininet_port(net, sw_from: str, sw_to: str) -> Optional[int]:
    """Mininet에서 sw_from → sw_to 방향의 OpenFlow 포트 번호 반환.

    TCIntf는 .port 속성이 없으므로 OVSSwitch.ports 딕셔너리(intf→port)를
    우선 사용하고, 없으면 인터페이스 이름('s1-eth2' → 2)에서 파싱한다.
    """
    sw_node = net.get(sw_from)
    for link in net.links:
        n1, n2 = link.intf1.node.name, link.intf2.node.name
        if n1 == sw_from and n2 == sw_to:
            intf = link.intf1
        elif n2 == sw_from and n1 == sw_to:
            intf = link.intf2
        else:
            continue

        # OVSSwitch.ports: {intf → port_num}
        if hasattr(sw_node, 'ports') and intf in sw_node.ports:
            return sw_node.ports[intf]
        # 이름 파싱 fallback: 's1-eth2' → 2
        try:
            return int(intf.name.split('eth')[-1])
        except (ValueError, IndexError):
            pass
    return None


@dataclass
class TwinResult:
    """Digital Twin 검증 결과"""

    status: str  # "passed" | "failed" | "skipped" | "error"
    reason: str = ""
    checks: dict = field(default_factory=dict)
    evidence: dict = field(default_factory=dict)

    def summary(self) -> str:
        status_map = {
            "passed": "PASS",
            "failed": "FAIL",
            "skipped": "SKIP",
            "error": "ERROR",
        }
        label = status_map.get(self.status, self.status.upper())
        if self.reason:
            return f"{label}: {self.reason}"
        return label


class TwinVerifier:
    """Mininet Digital Twin을 사용한 FlowRule 검증기"""

    def __init__(
        self,
        onos_url: Optional[str] = None,
        onos_user: Optional[str] = None,
        onos_password: Optional[str] = None,
        controller_ip: str = "127.0.0.1",
        controller_port: int = 6653,
    ) -> None:
        import config
        self.onos_url = onos_url or config.ONOS_URL
        self.onos_user = onos_user or config.ONOS_USER
        self.onos_password = onos_password or config.ONOS_PASSWORD
        self.controller_ip = controller_ip
        self.controller_port = controller_port

    def _log(self, msg: str) -> None:
        """진행 상황을 서버 콘솔과 UI 콜백(있으면)에 동시 출력."""
        print(f"    [Twin] {msg}")
        if getattr(self, "_progress_cb", None):
            self._progress_cb(msg)

    def verify(self, flowrule: dict, progress_cb=None) -> TwinResult:
        """
        FlowRule을 Digital Twin에 배포하고 검증한다.

        검증 항목:
          1. baseline_connectivity: FlowRule 배포 전 기본 연결성
          2. intent_check: FlowRule의 의도 동작
             - block이면 타겟 pair 차단 확인
             - forward이면 타겟 pair 전달 확인
          3. regression: 관련 없는 host pair 영향 없음

        Args:
            flowrule:    {"flows": [...]} 형식의 FlowRule dict
            progress_cb: 진행 상황 UI 전달용 콜백 (str → None), 없으면 콘솔만

        Returns:
            TwinResult
        """
        self._progress_cb = progress_cb
        # ── 플랫폼 체크 ────────────────────────────────────────
        skip_reason = self._check_platform()
        if skip_reason:
            return TwinResult(status="skipped", reason=skip_reason)

        from stage4_twin.onos_client import OnosClient, OnosError
        from stage4_twin.topology import (
            build_network, build_network_from_custom,
            get_expected_device_ids, get_test_host_pairs,
            EXPECTED_DEVICE_IDS,
        )

        client = OnosClient(
            base_url=self.onos_url,
            username=self.onos_user,
            password=self.onos_password,
        )

        # ── 커스텀 토폴로지 로드 ───────────────────────────
        custom_data = self._load_custom_topology()
        expected_ids = get_expected_device_ids(custom_data)
        primary_pair, regression_pair = get_test_host_pairs(custom_data)

        # SFC 인텐트: waypoint 경유 테스트는 실제 방화벽 장치 없이 검증 불가 → skip
        if flowrule.get("sfc_chain"):
            return TwinResult(
                status="skipped",
                reason="SFC 인텐트는 Digital Twin에서 waypoint 장치 없이 검증 불가",
            )

        # FlowRule에서 action 추출
        flows = flowrule.get("flows", [])
        flow = flows[0] if flows else {}
        instructions = flow.get("treatment", {}).get("instructions", [])
        has_output = any(i.get("type") == "OUTPUT" for i in instructions)
        action = "forward" if has_output else "block"

        # 타겟 pair 결정 및 프로토콜/포트 추출
        criteria = flow.get("selector", {}).get("criteria", [])
        src_ip = None
        dst_ip = None
        flow_proto = None   # "tcp" | "udp" | "icmp" | None
        flow_dst_port = None  # int | None
        for c in criteria:
            if c["type"] == "IPV4_SRC":
                src_ip = c.get("ip", "").split("/")[0]
            elif c["type"] == "IPV4_DST":
                dst_ip = c.get("ip", "").split("/")[0]
            elif c["type"] == "IP_PROTO":
                proto_num = c.get("protocol")
                flow_proto = {6: "tcp", 17: "udp", 1: "icmp"}.get(proto_num)
            elif c["type"] == "TCP_DST":
                flow_dst_port = c.get("tcpPort")
            elif c["type"] == "UDP_DST":
                flow_dst_port = c.get("udpPort")

        if src_ip is None and dst_ip is None:
            return TwinResult(
                status="skipped",
                reason="FlowRule에 IPV4_SRC/IPV4_DST criteria가 없어 트래픽 검증 대상을 특정할 수 없음",
            )

        # IP→호스트 매핑 (커스텀 토폴로지 우선, 없으면 Diamond 기본값)
        ip_to_host: dict[str, str] = {}
        if custom_data:
            for h in custom_data.get("hosts", []):
                if h.get("ip"):
                    ip_to_host[h["ip"]] = h["id"]
        if not ip_to_host:
            ip_to_host = {
                "10.0.0.1": "h1", "10.0.0.2": "h2",
                "10.0.0.3": "h3", "10.0.0.4": "h4",
            }
        dst_host = ip_to_host.get(dst_ip or "", primary_pair[1])

        if src_ip is not None:
            src_host = ip_to_host.get(src_ip, primary_pair[0])
        else:
            # src_ip 미지정: dst_host가 아닌 다른 호스트를 소스로 선택.
            # 자기 자신에게 연결하면 루프백을 타서 스위치/블록룰을 우회하기 때문.
            src_host = next(
                (hid for hid in ip_to_host.values() if hid != dst_host),
                primary_pair[0],
            )

        # baseline ping 대상 IP (dst_host의 IP)
        baseline_dst_ip = dst_ip or next(
            (ip for ip, hid in ip_to_host.items() if hid == primary_pair[1]),
            "10.0.0.4",
        )

        net = None
        checks: dict = {}
        evidence: dict = {}

        try:
            # ── 1. ONOS 준비 대기 ──────────────────────────
            self._log("① ONOS 컨트롤러 준비 대기 중...")
            client.wait_until_ready(timeout=60.0)

            # ── 2. 필수 ONOS 앱 활성화 ────────────────────
            self._log("② ONOS OpenFlow 앱 활성화 중...")
            for app in [
                "org.onosproject.openflow-base",
                "org.onosproject.openflow",
                "org.onosproject.fwd",
            ]:
                try:
                    client.activate_application(app)
                except Exception:
                    pass
            time.sleep(2)

            # ── 3. 기존 flow 정리 ──────────────────────────
            self._log("③ 기존 flow 정리 중...")
            client.clear_app_flows()
            time.sleep(1)

            # ── 4. Mininet 토폴로지 시작 ───────────────────
            self._log("④ 잔존 Mininet 인터페이스 정리 중...")
            subprocess.run(
                ["mn", "-c"],
                capture_output=True,
                timeout=15,
            )

            if custom_data:
                sw_cnt = len(custom_data.get("switches", []))
                h_cnt  = len(custom_data.get("hosts", []))
                self._log(f"④ Mininet 가상 네트워크 시작 중... (커스텀 토폴로지 {sw_cnt}SW/{h_cnt}H)")
                net = build_network_from_custom(custom_data, self.controller_ip, self.controller_port)
            else:
                self._log("④ Mininet 가상 네트워크 시작 중... (다이아몬드 기본 토폴로지)")
                net = build_network(self.controller_ip, self.controller_port)
            net.start()

            self._log("④ ONOS에 가상 스위치 연결 대기 중... (Live Topology에 가상 스위치가 표시됩니다)")
            client.wait_for_devices(expected_ids, timeout=90.0)
            time.sleep(3)

            # ── 5. baseline 연결성 확인 ────────────────────
            self._log(f"⑤ [baseline] FlowRule 배포 전 연결성 확인: {src_host} → {baseline_dst_ip}")
            baseline_ok, baseline_msg = self._ping_check(
                net, src_host, baseline_dst_ip, expect_reach=True
            )
            checks["baseline_connectivity"] = baseline_ok
            evidence["baseline_msg"] = baseline_msg
            self._log(f"   {'✓' if baseline_ok else '✗'} {baseline_msg}")

            # ── 5. FlowRule 배포 ───────────────────────────
            self._log("⑥ FlowRule 가상 스위치에 배포 중...")
            client.deploy_flow_rules(flowrule)
            # 모든 flows가 OVS에 push될 때까지 대기 (B7 fix: flows[0]만 대기하던 버그)
            for f in flows:
                client.wait_for_flow(
                    device_id=f.get("deviceId", "of:0000000000000001"),
                    priority=f.get("priority", 50000),
                    timeout=15.0,
                )

            # ── 6. intent 동작 확인 ────────────────────────
            # ── 6a. block 인텐트: 스티어링 룰로 경로 강제 ───────────────
            # ONOS fwd 앱이 우선순위가 높거나 다른 경로를 선택하면 블록 스위치를
            # 우회할 수 있으므로, block 인텐트일 때는 해당 스위치를 반드시 경유하도록
            # 임시 OVS 스티어링 룰을 설치한 뒤 ping 검증을 수행한다.
            steered_switches: list[str] = []
            force_path: list[str] = []
            if action == "block" and custom_data and src_ip and dst_ip:
                block_sw_name = _device_id_to_sw_name(flow.get("deviceId", ""), custom_data)
                src_sw_name   = _find_host_switch(src_host, custom_data)
                if block_sw_name and src_sw_name:
                    sw_path = _bfs_sw_path(src_sw_name, block_sw_name, custom_data)
                    if len(sw_path) >= 2:
                        force_path = [src_host] + sw_path
                        self._log(
                            f"   ↳ 검증 경로 강제: {' → '.join(force_path)}"
                        )
                        for i in range(len(sw_path) - 1):
                            hop, nxt = sw_path[i], sw_path[i + 1]
                            port = _find_mininet_port(net, hop, nxt)
                            if port:
                                sw_node = net.get(hop)
                                sw_node.cmd(
                                    f'ovs-ofctl add-flow {hop} '
                                    f'"cookie={_STEERING_COOKIE},priority=55000,'
                                    f'ip,nw_src={src_ip},nw_dst={dst_ip},'
                                    f'actions=output:{port}" -O OpenFlow13'
                                )
                                steered_switches.append(hop)
                        if steered_switches:
                            time.sleep(1)

            # ── 6b. intent 동작 확인 ────────────────────────────────────
            expect_reach = (action == "forward")
            if flow_proto in ("tcp", "udp") and flow_dst_port is not None:
                proto_label = f"{flow_proto.upper()}/{flow_dst_port}"
                self._log(
                    f"⑦ [intent] {'전달 확인' if expect_reach else '차단 확인'}: "
                    f"{src_host} → {baseline_dst_ip}:{proto_label}"
                )
                intent_ok, intent_msg = self._port_check(
                    net, src_host, baseline_dst_ip,
                    proto=flow_proto, port=flow_dst_port,
                    expect_reach=expect_reach,
                )
            else:
                self._log(
                    f"⑦ [intent] {'전달 확인' if expect_reach else '차단 확인'}: "
                    f"{src_host} → {baseline_dst_ip} (ICMP)"
                )
                intent_ok, intent_msg = self._ping_check(
                    net, src_host, baseline_dst_ip, expect_reach=expect_reach
                )
            checks["intent_check"] = intent_ok
            evidence["intent_msg"] = intent_msg
            self._log(f"   {'✓' if intent_ok else '✗'} {intent_msg}")

            # ── 6c. 스티어링 룰 제거 ──────────────────────────────────
            for hop in steered_switches:
                sw_node = net.get(hop)
                sw_node.cmd(
                    f'ovs-ofctl del-flows {hop} '
                    f'"cookie={_STEERING_COOKIE}/-1" -O OpenFlow13'
                )
            if steered_switches:
                self._log("   ↳ 스티어링 룰 제거 완료")

            # ── 7. 회귀 테스트 ───────────────────────────
            host_to_ip = {hid: ip for ip, hid in ip_to_host.items()}
            if regression_pair == primary_pair:
                self._log("⑧ [regression] 독립 호스트 쌍 없음 — 스킵")
                checks["regression"] = True
                evidence["regression_msg"] = (
                    "회귀 테스트 스킵 — 독립적인 호스트 쌍 없음 "
                    f"(토폴로지 호스트 수: {len(ip_to_host)}개)"
                )
            else:
                regression_dst_ip = host_to_ip.get(regression_pair[1], "10.0.0.3")
                self._log(
                    f"⑧ [regression] 영향 없어야 할 쌍 확인: "
                    f"{regression_pair[0]} → {regression_dst_ip}"
                )
                regression_ok, regression_msg = self._ping_check(
                    net, regression_pair[0], regression_dst_ip, expect_reach=True
                )
                checks["regression"] = regression_ok
                evidence["regression_msg"] = regression_msg
                self._log(f"   {'✓' if regression_ok else '✗'} {regression_msg}")

            # ── 판정 ──────────────────────────────────────
            all_passed = all(checks.values())
            status = "passed" if all_passed else "failed"
            failed_checks = [k for k, v in checks.items() if not v]
            reason = (
                f"실패한 검사: {', '.join(failed_checks)}"
                if failed_checks
                else "모든 검사 통과"
            )

            return TwinResult(
                status=status,
                reason=reason,
                checks=checks,
                evidence=evidence,
            )

        except Exception as exc:
            return TwinResult(
                status="error",
                reason=f"Digital Twin 오류: {exc}",
                checks=checks,
                evidence=evidence,
            )

        finally:
            # ── 8. rollback ───────────────────────────────
            self._log("⑨ FlowRule rollback 중...")
            try:
                priority = flow.get("priority")
                if priority is not None:
                    client.delete_flows_by_priority(priority)
                else:
                    client.clear_app_flows()
            except Exception:
                pass

            # ── 9. Mininet 종료 ───────────────────────────
            if net is not None:
                self._log("⑩ Mininet 가상 네트워크 종료 중...")
                try:
                    net.stop()
                except Exception:
                    pass
            # 인터페이스 완전 정리 (다음 실행 시 File exists 방지)
            try:
                subprocess.run(["mn", "-c"], capture_output=True, timeout=15)
            except Exception:
                pass

    def _ping_check(
        self,
        net,
        src_host: str,
        dst_ip: str,
        expect_reach: bool,
    ) -> tuple[bool, str]:
        """
        src_host에서 dst_ip로 ping을 전송하고 결과를 확인한다.

        Args:
            net: Mininet 객체
            src_host: 소스 호스트 이름 (예: "h1")
            dst_ip: 대상 IP 주소 (예: "10.0.0.4")
            expect_reach: True이면 도달 가능해야 함, False이면 차단되어야 함

        Returns:
            (성공 여부, 설명 메시지)
        """
        try:
            host = net.get(src_host)
            # dst_ip 형식 검증 (shell injection 방지)
            if not re.match(r"^[\d.]+$", dst_ip):
                return False, f"잘못된 IP 형식: {dst_ip}"

            host.sendCmd(f"ping -c 3 -W 1 {dst_ip}")
            result = host.waitOutput()

            # "0% packet loss" in "100% packet loss" 가 True가 되는 버그 방지
            # → regex로 실제 packet loss % 추출
            m = re.search(r"(\d+)% packet loss", result)
            loss_pct = int(m.group(1)) if m else 100
            reachable = (loss_pct == 0)

            if expect_reach:
                success = reachable
                msg = (
                    f"{src_host}→{dst_ip} ping 성공 (예상: 도달 가능)"
                    if success
                    else f"{src_host}→{dst_ip} ping 실패 (예상: 도달 가능이어야 함)"
                )
            else:
                success = not reachable
                msg = (
                    f"{src_host}→{dst_ip} ping 차단됨 (예상: 차단)"
                    if success
                    else f"{src_host}→{dst_ip} ping 통과됨 (예상: 차단이어야 함)"
                )

            return success, msg

        except Exception as exc:
            return False, f"ping 실행 오류: {exc}"

    def _port_check(
        self,
        net,
        src_host: str,
        dst_ip: str,
        proto: str,
        port: int,
        expect_reach: bool,
    ) -> tuple[bool, str]:
        """
        TCP/UDP 포트 연결 테스트.
        Python socket으로 SYN을 보내고 응답을 확인한다.

        - 연결 성공 (errno 0) 또는 연결 거부 (errno 111 ECONNREFUSED):
            패킷이 목적지에 도달한 것 → reachable=True
        - 타임아웃 (errno 110 ETIMEDOUT) 등:
            패킷이 스위치에서 DROP된 것 → reachable=False

        Args:
            net: Mininet 객체
            src_host: 소스 호스트 이름 (예: "h4")
            dst_ip: 대상 IP 주소
            proto: "tcp" 또는 "udp"
            port: 대상 포트 번호
            expect_reach: True이면 도달 가능해야 함

        Returns:
            (성공 여부, 설명 메시지)
        """
        try:
            if not re.match(r"^[\d.]+$", dst_ip):
                return False, f"잘못된 IP 형식: {dst_ip}"
            port = int(port)

            host = net.get(src_host)

            # Python socket으로 TCP SYN 전송 후 응답 분류
            # ECONNREFUSED(111): 패킷 도달, 서비스 없음 → reachable
            # ETIMEDOUT(110) / 기타: DROP → not reachable
            cmd = (
                f"python3 -c \""
                f"import socket,errno;"
                f"s=socket.socket({'socket.AF_INET' if True else ''});"
                f"s.settimeout(3);"
                f"e=s.connect_ex(('{dst_ip}',{port}));"
                f"s.close();"
                f"print('REACHABLE' if e==0 or e==errno.ECONNREFUSED else 'BLOCKED')"
                f"\""
            )
            host.sendCmd(cmd)
            result = host.waitOutput()
            reachable = "REACHABLE" in result

            proto_label = f"{proto.upper()}/{port}"
            if expect_reach:
                success = reachable
                msg = (
                    f"{src_host}→{dst_ip}:{proto_label} 연결 가능 (예상: 도달 가능)"
                    if success
                    else f"{src_host}→{dst_ip}:{proto_label} 연결 실패 (예상: 도달 가능이어야 함)"
                )
            else:
                success = not reachable
                msg = (
                    f"{src_host}→{dst_ip}:{proto_label} 차단됨 (예상: 차단)"
                    if success
                    else f"{src_host}→{dst_ip}:{proto_label} 통과됨 (예상: 차단이어야 함)"
                )

            return success, msg

        except Exception as exc:
            return False, f"포트 테스트 오류: {exc}"

    def _load_custom_topology(self) -> Optional[dict]:
        """
        data/custom_topology.json 로드. 없으면 None 반환.
        UI 에디터에서 저장한 커스텀 토폴로지를 Digital Twin에 반영한다.
        """
        import json
        from pathlib import Path
        path = Path(__file__).resolve().parent.parent.parent / "data" / "custom_topology.json"
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                pass
        return None

    @staticmethod
    def _check_platform() -> str:
        """
        실행 환경을 확인하고 문제가 있으면 이유를 반환한다.
        문제 없으면 빈 문자열 반환.
        """
        if sys.platform != "linux":
            return f"플랫폼이 Linux가 아님 (현재: {sys.platform})"

        if os.geteuid() != 0:
            return "root 권한 없음 (sudo -E로 실행하세요)"

        try:
            subprocess.run(
                ["mn", "--version"],
                capture_output=True,
                check=True,
                timeout=5,
            )
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            return "Mininet(mn)이 설치되지 않음"

        return ""  # 모든 조건 충족
