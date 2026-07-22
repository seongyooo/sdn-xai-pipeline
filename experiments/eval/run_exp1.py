"""
experiments/eval/run_exp1.py - Exp-1 Batch Runner

Calls Gemini API for each intent in the dataset according to the
specified treatment config (T-A through T-D), for N repetitions.
Writes one JSONL file per repetition under the output directory.

Usage:
    python experiments/eval/run_exp1.py --config experiments/eval/config/T-D.toml
    python experiments/eval/run_exp1.py --config experiments/eval/config/T-A.toml --repetitions 3
    python experiments/eval/run_exp1.py --config experiments/eval/config/T-D.toml --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from pathlib import Path

# ── Project root on sys.path ──────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "pipeline"))

try:
    import tomllib  # Python 3.11+
except ImportError:
    try:
        import tomli as tomllib  # pip install tomli
    except ImportError:
        raise RuntimeError("tomllib not available — run: pip install tomli")

import config as pipeline_config  # loads GOOGLE_API_KEY from .env

# ════════════════════════════════════════════════════════════════════════
# System prompts
# ════════════════════════════════════════════════════════════════════════

# T-B / T-C / T-D  (IntentIR output)
from stage1_intent.intent_parser import SYSTEM_PROMPT as SYSTEM_INTENT_IR

# T-A  (direct ONOS FlowRule output)
SYSTEM_DIRECT_FLOW = """You are an SDN network operator. Given a natural language network intent, output ONOS FlowRule JSON directly. Output strict JSON only — no explanation.

## Output format

For VALID intents, output ONOS batch flow API format:
{
  "flows": [
    {
      "deviceId": "<of:hex_id>",
      "priority": 40000,
      "timeout": 0,
      "isPermanent": true,
      "treatment": {
        "instructions": [
          {"type": "OUTPUT", "port": "<port_number_as_string>"}
        ]
      },
      "selector": {
        "criteria": [
          {"type": "ETH_TYPE", "ethType": "0x800"},
          {"type": "IPV4_SRC", "ip": "<src_ip>/32"},
          {"type": "IPV4_DST", "ip": "<dst_ip>/32"},
          {"type": "IP_PROTO", "protocol": <6|17|1>},
          {"type": "TCP_DST", "tcpPort": <port>}
        ]
      }
    }
  ]
}

Rules by action type:
- forward : OUTPUT instruction with the egress port number
- block   : empty instructions array (DROP)
- qos     : OUTPUT instruction + {"type": "QUEUE", "queueId": <n>, "port": "<port>"}
- sfc     : TWO flows — first routes to the waypoint port, second routes after returning
- reroute : OUTPUT instruction with an alternate egress port or via a specific device

Selector criteria types:
  ETH_TYPE  : ethType "0x800" for IPv4, "0x806" for ARP
  IP_PROTO  : protocol 6 (TCP), 17 (UDP), 1 (ICMP)
  IPV4_SRC / IPV4_DST : IP with /32 mask
  TCP_DST / TCP_SRC / UDP_DST / UDP_SRC : port number (integer)

For INVALID intents:
{"status": "rejected", "rejection_reason": "<reason>", "rejection_detail": "<brief explanation>"}

Rejection reasons:
- "ambiguous"      : too vague or missing required src/dst endpoints (block/forward require both src and dst IP)
- "unknown_entity" : host, IP, or switch not in the topology
- "contradictory"  : mutually exclusive requirements on the same traffic flow
- "unsupported"    : MPLS, BGP, multicast, firmware changes, ML-based QoS, etc.

src/dst IP requirements:
- For forward and block: BOTH source IP and destination IP must be specified.
  If either is missing, reject with reason "ambiguous".
- For qos, sfc, reroute: source/destination IP are recommended but not strictly required."""


# ════════════════════════════════════════════════════════════════════════
# Config / data loaders
# ════════════════════════════════════════════════════════════════════════

def load_config(path: Path) -> dict:
    with open(path, "rb") as f:
        return tomllib.load(f)


def load_dataset(path: Path) -> list[dict]:
    cases = [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    return cases


def _build_topology_prompt(topo_data: dict) -> str:
    """Build grounding prompt text from eval topology JSON format."""
    hosts: list[str] = []
    switch_lines: list[str] = []
    ports_map: dict[str, list[int]] = topo_data.get("ports", {})

    for entity in topo_data.get("entities", []):
        eid = entity["id"]
        aliases = entity.get("aliases", [])
        if eid.startswith("host:"):
            # aliases: [name, ip, ip/32] or [name, ip]
            name = aliases[0] if aliases else eid
            ip = next((a for a in aliases if "." in a and "/" not in a), "")
            if ip:
                hosts.append(f"{name}={ip}")
        elif eid.startswith("device:"):
            # aliases: [short_name, "switch N", "switchN", "of:..."]
            name = aliases[0] if aliases else eid
            onos_id = next((a for a in aliases if a.startswith("of:")), "")
            ports = sorted(ports_map.get(onos_id, []))
            port_str = ",".join(str(p) for p in ports)
            switch_lines.append(f"    {name} ({onos_id}) ports: {port_str}")

    host_str = ", ".join(hosts)
    switch_str = "\n".join(switch_lines)

    waypoints = topo_data.get("ids_waypoints", [])
    wp_str = ", ".join(waypoints) if waypoints else "none"

    return (
        f"Network topology (ONLY reference entities listed here - do not invent others):\n"
        f"  Hosts: {host_str}\n"
        f"  Switches:\n{switch_str}\n"
        f"  IDS/Firewall waypoints: {wp_str}\n"
        f"If the intent mentions a host IP or switch not in this list, "
        f"reject with reason \"unknown_entity\"."
    )


def load_topology_prompt(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    return _build_topology_prompt(data)


def load_demos_prompt(path: Path) -> str:
    """Build static few-shot block from demonstrations.json."""
    demos = json.loads(path.read_text(encoding="utf-8"))
    lines = ["## Examples (follow this format exactly)\n"]
    for demo in demos:
        instruction = demo["instruction"]
        output = json.dumps(demo["output"], ensure_ascii=False)
        lines.append(f"Input: {instruction}")
        lines.append(f"Output: {output}")
        lines.append("")
    return "\n".join(lines)


def build_system_prompt(
    output_format: str,
    few_shot: bool,
    grounding: bool,
    topology_prompt: str,
    demos_prompt: str,
) -> str:
    """Assemble the full system prompt for the given treatment."""
    if output_format == "direct_flow":
        base = SYSTEM_DIRECT_FLOW
    else:
        base = SYSTEM_INTENT_IR

    parts = []

    # Grounding goes FIRST (so LLM sees it before the schema rules)
    if grounding and topology_prompt:
        parts.append(topology_prompt)

    parts.append(base)

    # Few-shot examples go LAST (closest to the user turn)
    if few_shot and demos_prompt:
        parts.append(demos_prompt)

    return "\n\n".join(parts)


# ════════════════════════════════════════════════════════════════════════
# Gemini API call with timing + token counting
# ════════════════════════════════════════════════════════════════════════

def call_gemini(
    model: str,
    system: str,
    user: str,
    temperature: float = 0.2,
    timeout_s: float = 30.0,
    retries: int = 2,
) -> tuple[str | None, dict | None, int, int, float, str | None, str | None]:
    """
    Call Gemini and return:
      (raw_text, parsed_json, input_tokens, output_tokens, latency_ms, error_kind, error_msg)

    error_kind: None | "transport" | "schema_invalid"
    """
    from google import genai
    from google.genai import types

    api_key = pipeline_config.GOOGLE_API_KEY
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY not set — check .env file")

    client = genai.Client(api_key=api_key)
    max_attempts = retries + 1

    for attempt in range(max_attempts):
        t0 = time.perf_counter()
        try:
            response = client.models.generate_content(
                model=model,
                contents=user,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    temperature=temperature,
                ),
            )
            latency_ms = (time.perf_counter() - t0) * 1000

            raw_text = response.text or ""
            usage = response.usage_metadata
            input_tokens = getattr(usage, "prompt_token_count", 0) or 0
            output_tokens = getattr(usage, "candidates_token_count", 0) or 0

            try:
                parsed = json.loads(raw_text)
            except json.JSONDecodeError as exc:
                return raw_text, None, input_tokens, output_tokens, latency_ms, "schema_invalid", str(exc)

            return raw_text, parsed, input_tokens, output_tokens, latency_ms, None, None

        except Exception as exc:
            latency_ms = (time.perf_counter() - t0) * 1000
            err_str = str(exc)

            if attempt < max_attempts - 1:
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    wait = [5, 15, 30][min(attempt, 2)]
                else:
                    wait = 2 ** attempt
                print(f"    [retry {attempt+1}/{max_attempts}] {err_str[:80]} - wait {wait}s")
                time.sleep(wait)
            else:
                return None, None, 0, 0, latency_ms, "transport", err_str

    return None, None, 0, 0, 0.0, "transport", "max retries exceeded"


# ════════════════════════════════════════════════════════════════════════
# Main runner
# ════════════════════════════════════════════════════════════════════════

def run(
    cfg: dict,
    dataset: list[dict],
    system_prompt: str,
    repetitions: int,
    output_dir: Path,
    dry_run: bool = False,
) -> None:
    exp = cfg["experiment"]
    llm = cfg["llm"]

    treatment  = exp["treatment"]
    model      = llm["model"]
    temperature = float(llm.get("temperature", 0.2))
    timeout_s  = float(llm.get("timeout_s", 30.0))
    retries    = int(llm.get("retries", 2))

    # Stable run_id across all repetitions of this execution
    model_slug = model.replace(".", "")  # e.g. "gemini-3.1-flash-lite" -> "gemini-31-flash-lite"
    run_uuid   = uuid.uuid4().hex[:8]
    run_id     = f"{treatment}-{model_slug}-{run_uuid}"

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*65}")
    print(f"  Exp-1 Run: {run_id}")
    print(f"  Treatment : {treatment}")
    print(f"  Model     : {model}  temp={temperature}")
    print(f"  Dataset   : {len(dataset)} cases  x  {repetitions} reps")
    print(f"  Output    : {output_dir}")
    if dry_run:
        print(f"  [DRY RUN] - no API calls will be made")
    print(f"{'='*65}\n")

    total_cases = len(dataset)

    for rep in range(1, repetitions + 1):
        out_file = output_dir / f"{run_id}-r{rep:02d}.jsonl"
        print(f"  Rep {rep}/{repetitions} -> {out_file.name}")

        records: list[dict] = []

        for i, case in enumerate(dataset):
            case_id   = case["case_id"]
            intent    = case["intent_text"]
            gold_status = case["gold"]["status"]

            prefix = f"    [{i+1:02d}/{total_cases}] {case_id:<14}"

            if dry_run:
                print(f"{prefix} [DRY RUN skip]")
                records.append({
                    "case_id":       case_id,
                    "treatment":     treatment,
                    "model":         model,
                    "run_id":        run_id,
                    "repetition":    rep,
                    "output":        None,
                    "raw_content":   None,
                    "latency_ms":    0.0,
                    "input_tokens":  0,
                    "output_tokens": 0,
                    "error_kind":    "dry_run",
                    "error":         None,
                })
                continue

            raw_text, parsed, in_tok, out_tok, latency, err_kind, err_msg = call_gemini(
                model=model,
                system=system_prompt,
                user=intent,
                temperature=temperature,
                timeout_s=timeout_s,
                retries=retries,
            )

            status_tag = ""
            if err_kind:
                status_tag = f"[{err_kind}]"
            elif parsed is not None:
                if parsed.get("status") == "rejected":
                    status_tag = "[rejected]"
                elif "flows" in parsed:
                    status_tag = f"[{len(parsed['flows'])} flow(s)]"
                elif "rules" in parsed:
                    status_tag = f"[{len(parsed['rules'])} rule(s)]"
                else:
                    status_tag = "[ok]"

            print(f"{prefix} {latency:6.0f}ms  in={in_tok} out={out_tok}  {status_tag}")

            records.append({
                "case_id":       case_id,
                "treatment":     treatment,
                "model":         model,
                "run_id":        run_id,
                "repetition":    rep,
                "output":        parsed,
                "raw_content":   raw_text,
                "latency_ms":    round(latency, 1),
                "input_tokens":  in_tok,
                "output_tokens": out_tok,
                "error_kind":    err_kind,
                "error":         err_msg,
            })

            # Rate limit: 4K RPM -> no delay needed (bottleneck is API response ~1.5s)
            time.sleep(0.0)

        # Write JSONL for this repetition
        with open(out_file, "w", encoding="utf-8") as f:
            for rec in records:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

        pass_count = sum(1 for r in records if r["error_kind"] is None)
        fail_count = sum(1 for r in records if r["error_kind"] is not None)
        print(f"    -> saved {len(records)} records  (ok={pass_count}, err={fail_count})\n")

    print(f"Done. run_id={run_id}\n")


# ════════════════════════════════════════════════════════════════════════
# CLI
# ════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(description="Exp-1 batch runner (Gemini API)")
    parser.add_argument("--config",      required=True, help="TOML config path (e.g. experiments/eval/config/T-D.toml)")
    parser.add_argument("--repetitions", type=int, default=10, help="Number of repetitions (default: 10)")
    parser.add_argument("--output",      default="experiments/eval/logs/", help="Output directory for JSONL files")
    parser.add_argument("--dry-run",     action="store_true", help="Skip API calls; write placeholder records")
    args = parser.parse_args()

    config_path = ROOT / args.config
    if not config_path.exists():
        print(f"ERROR: config not found: {config_path}")
        sys.exit(1)

    cfg = load_config(config_path)
    exp = cfg["experiment"]

    dataset_path  = ROOT / exp["dataset_path"]
    _topo_str     = exp.get("topology_path", "")
    topology_path = ROOT / _topo_str if _topo_str else None
    demos_path    = ROOT / exp.get("demos_path", "") if exp.get("demos_path") else None
    output_dir    = ROOT / args.output

    if not dataset_path.exists():
        print(f"ERROR: dataset not found: {dataset_path}")
        sys.exit(1)

    dataset = load_dataset(dataset_path)

    topology_prompt = ""
    if exp.get("grounding") and topology_path is not None and topology_path.exists():
        topology_prompt = load_topology_prompt(topology_path)

    demos_prompt = ""
    if exp.get("few_shot") and demos_path and demos_path.exists():
        demos_prompt = load_demos_prompt(demos_path)

    system_prompt = build_system_prompt(
        output_format   = exp.get("output_format", "intent_ir"),
        few_shot        = bool(exp.get("few_shot")),
        grounding       = bool(exp.get("grounding")),
        topology_prompt = topology_prompt,
        demos_prompt    = demos_prompt,
    )

    # Print prompt length for reference
    prompt_tokens_est = len(system_prompt) // 4
    print(f"System prompt: ~{prompt_tokens_est} tokens estimated ({len(system_prompt)} chars)")

    run(
        cfg        = cfg,
        dataset    = dataset,
        system_prompt = system_prompt,
        repetitions   = args.repetitions,
        output_dir    = output_dir,
        dry_run       = args.dry_run,
    )


if __name__ == "__main__":
    main()
