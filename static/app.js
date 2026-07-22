'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const TOPOLOGY_PRESETS = {
  diamond: {
    label: 'Diamond',
    switches: [
      { id: 's1', label: 'S1', dpid: '0000000000000001', x: 170, y: 80  },
      { id: 's2', label: 'S2', dpid: '0000000000000002', x: 85,  y: 165 },
      { id: 's3', label: 'S3', dpid: '0000000000000003', x: 255, y: 165 },
      { id: 's4', label: 'S4', dpid: '0000000000000004', x: 170, y: 245 },
    ],
    hosts: [
      { id: 'h1', label: 'H1', ip: '10.0.0.1', mac: '00:00:00:00:00:01', x: 170, y: 24  },
      { id: 'h2', label: 'H2', ip: '10.0.0.2', mac: '00:00:00:00:00:02', x: 24,  y: 160 },
      { id: 'h3', label: 'H3', ip: '10.0.0.3', mac: '00:00:00:00:00:03', x: 316, y: 160 },
      { id: 'h4', label: 'H4', ip: '10.0.0.4', mac: '00:00:00:00:00:04', x: 170, y: 268 },
    ],
    links: [
      { id: 'l1', source: 's1', target: 's2', bw: 10 },
      { id: 'l2', source: 's1', target: 's3', bw: 10 },
      { id: 'l3', source: 's2', target: 's4', bw: 10 },
      { id: 'l4', source: 's3', target: 's4', bw: 10 },
      { id: 'l5', source: 'h1', target: 's1', bw: 100 },
      { id: 'l6', source: 'h2', target: 's2', bw: 100 },
      { id: 'l7', source: 'h3', target: 's3', bw: 100 },
      { id: 'l8', source: 'h4', target: 's4', bw: 100 },
    ],
  },
  linear: {
    label: 'Linear',
    switches: [
      { id: 's1', label: 'S1', dpid: '0000000000000001', x: 110, y: 140 },
      { id: 's2', label: 'S2', dpid: '0000000000000002', x: 230, y: 140 },
    ],
    hosts: [
      { id: 'h1', label: 'H1', ip: '10.0.0.1', mac: '00:00:00:00:00:01', x: 30,  y: 140 },
      { id: 'h2', label: 'H2', ip: '10.0.0.2', mac: '00:00:00:00:00:02', x: 310, y: 140 },
    ],
    links: [
      { id: 'l1', source: 'h1', target: 's1', bw: 100 },
      { id: 'l2', source: 's1', target: 's2', bw: 10  },
      { id: 'l3', source: 's2', target: 'h2', bw: 100 },
    ],
  },
  ring: {
    label: 'Ring',
    switches: [
      { id: 's1', label: 'S1', dpid: '0000000000000001', x: 170, y: 65  },
      { id: 's2', label: 'S2', dpid: '0000000000000002', x: 80,  y: 210 },
      { id: 's3', label: 'S3', dpid: '0000000000000003', x: 260, y: 210 },
    ],
    hosts: [
      { id: 'h1', label: 'H1', ip: '10.0.0.1', mac: '00:00:00:00:00:01', x: 170, y: 20  },
      { id: 'h2', label: 'H2', ip: '10.0.0.2', mac: '00:00:00:00:00:02', x: 25,  y: 230 },
      { id: 'h3', label: 'H3', ip: '10.0.0.3', mac: '00:00:00:00:00:03', x: 315, y: 230 },
    ],
    links: [
      { id: 'l1', source: 's1', target: 's2', bw: 10  },
      { id: 'l2', source: 's2', target: 's3', bw: 10  },
      { id: 'l3', source: 's3', target: 's1', bw: 10  },
      { id: 'l4', source: 'h1', target: 's1', bw: 100 },
      { id: 'l5', source: 'h2', target: 's2', bw: 100 },
      { id: 'l6', source: 'h3', target: 's3', bw: 100 },
    ],
  },

  // ── 추가 프리셋 ────────────────────────────────────────────────────────────

  // Spine-Leaf: 현대 데이터센터 표준 구조
  // 2 Spine (완전 연결) × 4 Leaf, 각 Leaf에 호스트 2개
  'spine-leaf': {
    label: 'Spine-Leaf',
    switches: [
      { id: 's1', label: 'S1', dpid: '0000000000000001', x: 110, y: 70  }, // Spine
      { id: 's2', label: 'S2', dpid: '0000000000000002', x: 230, y: 70  }, // Spine
      { id: 's3', label: 'S3', dpid: '0000000000000003', x: 40,  y: 175 }, // Leaf
      { id: 's4', label: 'S4', dpid: '0000000000000004', x: 125, y: 175 }, // Leaf
      { id: 's5', label: 'S5', dpid: '0000000000000005', x: 210, y: 175 }, // Leaf
      { id: 's6', label: 'S6', dpid: '0000000000000006', x: 300, y: 175 }, // Leaf
    ],
    hosts: [
      { id: 'h1', label: 'H1', ip: '10.0.0.1', mac: '00:00:00:00:00:01', x: 18,  y: 255 },
      { id: 'h2', label: 'H2', ip: '10.0.0.2', mac: '00:00:00:00:00:02', x: 65,  y: 255 },
      { id: 'h3', label: 'H3', ip: '10.0.0.3', mac: '00:00:00:00:00:03', x: 100, y: 255 },
      { id: 'h4', label: 'H4', ip: '10.0.0.4', mac: '00:00:00:00:00:04', x: 150, y: 255 },
      { id: 'h5', label: 'H5', ip: '10.0.0.5', mac: '00:00:00:00:00:05', x: 185, y: 255 },
      { id: 'h6', label: 'H6', ip: '10.0.0.6', mac: '00:00:00:00:00:06', x: 235, y: 255 },
      { id: 'h7', label: 'H7', ip: '10.0.0.7', mac: '00:00:00:00:00:07', x: 275, y: 255 },
      { id: 'h8', label: 'H8', ip: '10.0.0.8', mac: '00:00:00:00:00:08', x: 325, y: 255 },
    ],
    links: [
      // Each spine → all leaves (full bipartite)
      { id: 'l1',  source: 's1', target: 's3', bw: 40 },
      { id: 'l2',  source: 's1', target: 's4', bw: 40 },
      { id: 'l3',  source: 's1', target: 's5', bw: 40 },
      { id: 'l4',  source: 's1', target: 's6', bw: 40 },
      { id: 'l5',  source: 's2', target: 's3', bw: 40 },
      { id: 'l6',  source: 's2', target: 's4', bw: 40 },
      { id: 'l7',  source: 's2', target: 's5', bw: 40 },
      { id: 'l8',  source: 's2', target: 's6', bw: 40 },
      // Leaf → hosts (2 per leaf)
      { id: 'l9',  source: 's3', target: 'h1', bw: 1 },
      { id: 'l10', source: 's3', target: 'h2', bw: 1 },
      { id: 'l11', source: 's4', target: 'h3', bw: 1 },
      { id: 'l12', source: 's4', target: 'h4', bw: 1 },
      { id: 'l13', source: 's5', target: 'h5', bw: 1 },
      { id: 'l14', source: 's5', target: 'h6', bw: 1 },
      { id: 'l15', source: 's6', target: 'h7', bw: 1 },
      { id: 'l16', source: 's6', target: 'h8', bw: 1 },
    ],
  },

  // Fat-Tree (k=4, 2-pod simplified): 대규모 데이터센터 고대역폭 구조
  // Core 2개 × Agg 4개(팟당 2) × Edge 4개(팟당 2), 호스트 8개
  'fat-tree': {
    label: 'Fat-Tree',
    switches: [
      { id: 's1',  label: 'S1',  dpid: '0000000000000001', x: 120, y: 35  }, // Core
      { id: 's2',  label: 'S2',  dpid: '0000000000000002', x: 220, y: 35  }, // Core
      { id: 's3',  label: 'S3',  dpid: '0000000000000003', x: 65,  y: 115 }, // Pod1-Agg
      { id: 's4',  label: 'S4',  dpid: '0000000000000004', x: 145, y: 115 }, // Pod1-Agg
      { id: 's5',  label: 'S5',  dpid: '0000000000000005', x: 200, y: 115 }, // Pod2-Agg
      { id: 's6',  label: 'S6',  dpid: '0000000000000006', x: 275, y: 115 }, // Pod2-Agg
      { id: 's7',  label: 'S7',  dpid: '0000000000000007', x: 50,  y: 200 }, // Pod1-Edge
      { id: 's8',  label: 'S8',  dpid: '0000000000000008', x: 140, y: 200 }, // Pod1-Edge
      { id: 's9',  label: 'S9',  dpid: '0000000000000009', x: 200, y: 200 }, // Pod2-Edge
      { id: 's10', label: 'S10', dpid: '000000000000000a', x: 290, y: 200 }, // Pod2-Edge
    ],
    hosts: [
      { id: 'h1', label: 'H1', ip: '10.0.0.1', mac: '00:00:00:00:00:01', x: 25,  y: 265 },
      { id: 'h2', label: 'H2', ip: '10.0.0.2', mac: '00:00:00:00:00:02', x: 75,  y: 265 },
      { id: 'h3', label: 'H3', ip: '10.0.0.3', mac: '00:00:00:00:00:03', x: 115, y: 265 },
      { id: 'h4', label: 'H4', ip: '10.0.0.4', mac: '00:00:00:00:00:04', x: 165, y: 265 },
      { id: 'h5', label: 'H5', ip: '10.0.0.5', mac: '00:00:00:00:00:05', x: 175, y: 265 },
      { id: 'h6', label: 'H6', ip: '10.0.0.6', mac: '00:00:00:00:00:06', x: 225, y: 265 },
      { id: 'h7', label: 'H7', ip: '10.0.0.7', mac: '00:00:00:00:00:07', x: 265, y: 265 },
      { id: 'h8', label: 'H8', ip: '10.0.0.8', mac: '00:00:00:00:00:08', x: 315, y: 265 },
    ],
    links: [
      // Core → Aggregation (cross-pod connections)
      { id: 'l1',  source: 's1', target: 's3', bw: 40 },
      { id: 'l2',  source: 's1', target: 's5', bw: 40 },
      { id: 'l3',  source: 's2', target: 's4', bw: 40 },
      { id: 'l4',  source: 's2', target: 's6', bw: 40 },
      // Aggregation → Edge (within pod)
      { id: 'l5',  source: 's3', target: 's7',  bw: 10 },
      { id: 'l6',  source: 's3', target: 's8',  bw: 10 },
      { id: 'l7',  source: 's4', target: 's7',  bw: 10 },
      { id: 'l8',  source: 's4', target: 's8',  bw: 10 },
      { id: 'l9',  source: 's5', target: 's9',  bw: 10 },
      { id: 'l10', source: 's5', target: 's10', bw: 10 },
      { id: 'l11', source: 's6', target: 's9',  bw: 10 },
      { id: 'l12', source: 's6', target: 's10', bw: 10 },
      // Edge → hosts
      { id: 'l13', source: 's7',  target: 'h1', bw: 1 },
      { id: 'l14', source: 's7',  target: 'h2', bw: 1 },
      { id: 'l15', source: 's8',  target: 'h3', bw: 1 },
      { id: 'l16', source: 's8',  target: 'h4', bw: 1 },
      { id: 'l17', source: 's9',  target: 'h5', bw: 1 },
      { id: 'l18', source: 's9',  target: 'h6', bw: 1 },
      { id: 'l19', source: 's10', target: 'h7', bw: 1 },
      { id: 'l20', source: 's10', target: 'h8', bw: 1 },
    ],
  },

  // Tree (3-level binary): 전통적 계층형 캠퍼스/기업망
  // Root 1 → Aggregation 2 → Edge 4, 호스트 8개
  tree: {
    label: 'Tree',
    switches: [
      { id: 's1', label: 'S1', dpid: '0000000000000001', x: 170, y: 40  }, // Root
      { id: 's2', label: 'S2', dpid: '0000000000000002', x: 90,  y: 120 }, // Agg
      { id: 's3', label: 'S3', dpid: '0000000000000003', x: 250, y: 120 }, // Agg
      { id: 's4', label: 'S4', dpid: '0000000000000004', x: 45,  y: 205 }, // Edge
      { id: 's5', label: 'S5', dpid: '0000000000000005', x: 135, y: 205 }, // Edge
      { id: 's6', label: 'S6', dpid: '0000000000000006', x: 205, y: 205 }, // Edge
      { id: 's7', label: 'S7', dpid: '0000000000000007', x: 295, y: 205 }, // Edge
    ],
    hosts: [
      { id: 'h1', label: 'H1', ip: '10.0.0.1', mac: '00:00:00:00:00:01', x: 20,  y: 275 },
      { id: 'h2', label: 'H2', ip: '10.0.0.2', mac: '00:00:00:00:00:02', x: 70,  y: 275 },
      { id: 'h3', label: 'H3', ip: '10.0.0.3', mac: '00:00:00:00:00:03', x: 110, y: 275 },
      { id: 'h4', label: 'H4', ip: '10.0.0.4', mac: '00:00:00:00:00:04', x: 160, y: 275 },
      { id: 'h5', label: 'H5', ip: '10.0.0.5', mac: '00:00:00:00:00:05', x: 180, y: 275 },
      { id: 'h6', label: 'H6', ip: '10.0.0.6', mac: '00:00:00:00:00:06', x: 230, y: 275 },
      { id: 'h7', label: 'H7', ip: '10.0.0.7', mac: '00:00:00:00:00:07', x: 270, y: 275 },
      { id: 'h8', label: 'H8', ip: '10.0.0.8', mac: '00:00:00:00:00:08', x: 320, y: 275 },
    ],
    links: [
      { id: 'l1',  source: 's1', target: 's2', bw: 40 },
      { id: 'l2',  source: 's1', target: 's3', bw: 40 },
      { id: 'l3',  source: 's2', target: 's4', bw: 10 },
      { id: 'l4',  source: 's2', target: 's5', bw: 10 },
      { id: 'l5',  source: 's3', target: 's6', bw: 10 },
      { id: 'l6',  source: 's3', target: 's7', bw: 10 },
      { id: 'l7',  source: 's4', target: 'h1', bw: 1 },
      { id: 'l8',  source: 's4', target: 'h2', bw: 1 },
      { id: 'l9',  source: 's5', target: 'h3', bw: 1 },
      { id: 'l10', source: 's5', target: 'h4', bw: 1 },
      { id: 'l11', source: 's6', target: 'h5', bw: 1 },
      { id: 'l12', source: 's6', target: 'h6', bw: 1 },
      { id: 'l13', source: 's7', target: 'h7', bw: 1 },
      { id: 'l14', source: 's7', target: 'h8', bw: 1 },
    ],
  },

  // Full-Mesh: 스위치 간 완전 연결, 최대 경로 다양성
  // 4 switches × 6 links (완전 그래프), 호스트 8개
  'full-mesh': {
    label: 'Full Mesh',
    switches: [
      { id: 's1', label: 'S1', dpid: '0000000000000001', x: 115, y: 95  },
      { id: 's2', label: 'S2', dpid: '0000000000000002', x: 225, y: 95  },
      { id: 's3', label: 'S3', dpid: '0000000000000003', x: 115, y: 195 },
      { id: 's4', label: 'S4', dpid: '0000000000000004', x: 225, y: 195 },
    ],
    hosts: [
      { id: 'h1', label: 'H1', ip: '10.0.0.1', mac: '00:00:00:00:00:01', x: 50,  y: 50  },
      { id: 'h2', label: 'H2', ip: '10.0.0.2', mac: '00:00:00:00:00:02', x: 120, y: 28  },
      { id: 'h3', label: 'H3', ip: '10.0.0.3', mac: '00:00:00:00:00:03', x: 220, y: 28  },
      { id: 'h4', label: 'H4', ip: '10.0.0.4', mac: '00:00:00:00:00:04', x: 295, y: 50  },
      { id: 'h5', label: 'H5', ip: '10.0.0.5', mac: '00:00:00:00:00:05', x: 295, y: 240 },
      { id: 'h6', label: 'H6', ip: '10.0.0.6', mac: '00:00:00:00:00:06', x: 220, y: 260 },
      { id: 'h7', label: 'H7', ip: '10.0.0.7', mac: '00:00:00:00:00:07', x: 120, y: 260 },
      { id: 'h8', label: 'H8', ip: '10.0.0.8', mac: '00:00:00:00:00:08', x: 50,  y: 240 },
    ],
    links: [
      // Full mesh (n=4 → 6 inter-switch links)
      { id: 'l1',  source: 's1', target: 's2', bw: 10 },
      { id: 'l2',  source: 's1', target: 's3', bw: 10 },
      { id: 'l3',  source: 's1', target: 's4', bw: 10 },
      { id: 'l4',  source: 's2', target: 's3', bw: 10 },
      { id: 'l5',  source: 's2', target: 's4', bw: 10 },
      { id: 'l6',  source: 's3', target: 's4', bw: 10 },
      // 2 hosts per switch
      { id: 'l7',  source: 's1', target: 'h1', bw: 1 },
      { id: 'l8',  source: 's1', target: 'h2', bw: 1 },
      { id: 'l9',  source: 's2', target: 'h3', bw: 1 },
      { id: 'l10', source: 's2', target: 'h4', bw: 1 },
      { id: 'l11', source: 's4', target: 'h5', bw: 1 },
      { id: 'l12', source: 's4', target: 'h6', bw: 1 },
      { id: 'l13', source: 's3', target: 'h7', bw: 1 },
      { id: 'l14', source: 's3', target: 'h8', bw: 1 },
    ],
  },

  // Campus: 3계층 기업 캠퍼스망 (Core→Distribution→Access), 이중 업링크
  campus: {
    label: 'Campus',
    switches: [
      { id: 's1', label: 'S1', dpid: '0000000000000001', x: 170, y: 45  }, // Core
      { id: 's2', label: 'S2', dpid: '0000000000000002', x: 85,  y: 130 }, // Dist
      { id: 's3', label: 'S3', dpid: '0000000000000003', x: 255, y: 130 }, // Dist
      { id: 's4', label: 'S4', dpid: '0000000000000004', x: 45,  y: 220 }, // Access
      { id: 's5', label: 'S5', dpid: '0000000000000005', x: 170, y: 220 }, // Access (dual uplink)
      { id: 's6', label: 'S6', dpid: '0000000000000006', x: 295, y: 220 }, // Access
    ],
    hosts: [
      { id: 'h1', label: 'H1', ip: '10.0.0.1', mac: '00:00:00:00:00:01', x: 15,  y: 295 },
      { id: 'h2', label: 'H2', ip: '10.0.0.2', mac: '00:00:00:00:00:02', x: 75,  y: 295 },
      { id: 'h3', label: 'H3', ip: '10.0.0.3', mac: '00:00:00:00:00:03', x: 135, y: 295 },
      { id: 'h4', label: 'H4', ip: '10.0.0.4', mac: '00:00:00:00:00:04', x: 205, y: 295 },
      { id: 'h5', label: 'H5', ip: '10.0.0.5', mac: '00:00:00:00:00:05', x: 265, y: 295 },
      { id: 'h6', label: 'H6', ip: '10.0.0.6', mac: '00:00:00:00:00:06', x: 325, y: 295 },
    ],
    links: [
      { id: 'l1',  source: 's1', target: 's2', bw: 40 },
      { id: 'l2',  source: 's1', target: 's3', bw: 40 },
      { id: 'l3',  source: 's2', target: 's4', bw: 10 },
      { id: 'l4',  source: 's2', target: 's5', bw: 10 }, // S5 dual uplink ①
      { id: 'l5',  source: 's3', target: 's5', bw: 10 }, // S5 dual uplink ②
      { id: 'l6',  source: 's3', target: 's6', bw: 10 },
      { id: 'l7',  source: 's4', target: 'h1', bw: 1 },
      { id: 'l8',  source: 's4', target: 'h2', bw: 1 },
      { id: 'l9',  source: 's5', target: 'h3', bw: 1 },
      { id: 'l10', source: 's5', target: 'h4', bw: 1 },
      { id: 'l11', source: 's6', target: 'h5', bw: 1 },
      { id: 'l12', source: 's6', target: 'h6', bw: 1 },
    ],
  },

  // WAN Backbone: 비균등 비대칭 백본망 (ISP/GÉANT 스타일)
  // 8 PoP 스위치, 비규칙적 연결, 다양한 대역폭
  wan: {
    label: 'WAN Backbone',
    switches: [
      { id: 's1', label: 'S1', dpid: '0000000000000001', x: 80,  y: 75  }, // PoP-A
      { id: 's2', label: 'S2', dpid: '0000000000000002', x: 220, y: 55  }, // PoP-B
      { id: 's3', label: 'S3', dpid: '0000000000000003', x: 310, y: 145 }, // PoP-C
      { id: 's4', label: 'S4', dpid: '0000000000000004', x: 195, y: 175 }, // PoP-D (hub)
      { id: 's5', label: 'S5', dpid: '0000000000000005', x: 75,  y: 200 }, // PoP-E
      { id: 's6', label: 'S6', dpid: '0000000000000006', x: 300, y: 260 }, // PoP-F
      { id: 's7', label: 'S7', dpid: '0000000000000007', x: 160, y: 265 }, // PoP-G
      { id: 's8', label: 'S8', dpid: '0000000000000008', x: 50,  y: 295 }, // PoP-H
    ],
    hosts: [
      { id: 'h1', label: 'H1', ip: '10.0.0.1', mac: '00:00:00:00:00:01', x: 40,  y: 35  },
      { id: 'h2', label: 'H2', ip: '10.0.0.2', mac: '00:00:00:00:00:02', x: 200, y: 18  },
      { id: 'h3', label: 'H3', ip: '10.0.0.3', mac: '00:00:00:00:00:03', x: 330, y: 60  },
      { id: 'h4', label: 'H4', ip: '10.0.0.4', mac: '00:00:00:00:00:04', x: 330, y: 280 },
      { id: 'h5', label: 'H5', ip: '10.0.0.5', mac: '00:00:00:00:00:05', x: 160, y: 330 },
      { id: 'h6', label: 'H6', ip: '10.0.0.6', mac: '00:00:00:00:00:06', x: 20,  y: 330 },
      { id: 'h7', label: 'H7', ip: '10.0.0.7', mac: '00:00:00:00:00:07', x: 20,  y: 160 },
      { id: 'h8', label: 'H8', ip: '10.0.0.8', mac: '00:00:00:00:00:08', x: 260, y: 210 },
    ],
    links: [
      // Backbone (asymmetric, variable BW)
      { id: 'l1',  source: 's1', target: 's2', bw: 100 },
      { id: 'l2',  source: 's2', target: 's3', bw: 100 },
      { id: 'l3',  source: 's2', target: 's4', bw: 40  },
      { id: 'l4',  source: 's3', target: 's4', bw: 40  },
      { id: 'l5',  source: 's3', target: 's6', bw: 40  },
      { id: 'l6',  source: 's1', target: 's5', bw: 40  },
      { id: 'l7',  source: 's4', target: 's5', bw: 10  },
      { id: 'l8',  source: 's4', target: 's7', bw: 10  },
      { id: 'l9',  source: 's5', target: 's7', bw: 10  },
      { id: 'l10', source: 's5', target: 's8', bw: 10  },
      { id: 'l11', source: 's6', target: 's7', bw: 10  },
      // Host attachments (1 per PoP)
      { id: 'l12', source: 's1', target: 'h1', bw: 1 },
      { id: 'l13', source: 's2', target: 'h2', bw: 1 },
      { id: 'l14', source: 's3', target: 'h3', bw: 1 },
      { id: 'l15', source: 's6', target: 'h4', bw: 1 },
      { id: 'l16', source: 's7', target: 'h5', bw: 1 },
      { id: 'l17', source: 's8', target: 'h6', bw: 1 },
      { id: 'l18', source: 's5', target: 'h7', bw: 1 },
      { id: 'l19', source: 's4', target: 'h8', bw: 1 },
    ],
  },
};

const STAGE_DEFS = [
  { num: 1, name: '① Intent Parsing' },
  { num: 2, name: '② FlowRule Compile' },
  { num: 3, name: '③ Static Validation' },
  { num: 4, name: '④ Digital Twin' },
  { num: 5, name: '⑤ XAI Explanation' },
  { num: 6, name: '⑥ ONOS Deploy' },
];

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  intent: '',
  model: 'gemini-3.1-flash-lite',
  enableRag: false,
  skipTwin: false,
  skipDeploy: false,
  running: false,
  stages: STAGE_DEFS.map(s => ({
    ...s,
    status: 'idle',   // idle | running | done | error | skipped
    elapsed: null,
    result: null,
    expanded: false,
    progress_log: [],
  })),
  decision: null,
  decisionReport: null,
  confidenceBreakdown: {},
  history: [],
  refreshIn: 1,
  twinActive: false,
};

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function runPipeline() {
  if (state.running || !state.intent.trim()) return;

  state.running = true;
  state.decision = null;
  state.decisionReport = null;
  state.confidenceBreakdown = {};
  state.stages.forEach(s => {
    s.status = 'idle'; s.elapsed = null; s.result = null; s.expanded = false; s.progress_log = [];
  });
  buildStageCards();   // 이전 실행 카드 DOM 전체 초기화
  renderDecision();
  setRunBtn(true);

  try {
    const resp = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: state.intent,
        model: state.model,
        rag_k: 3,
        no_rag: !state.enableRag,
        skip_twin: state.skipTwin,
        skip_deploy: state.skipDeploy,
      }),
    });

    if (!resp.ok) throw new Error(`Server error: ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const chunks = buf.split('\n\n');
      buf = chunks.pop(); // keep incomplete chunk
      for (const chunk of chunks) {
        const line = chunk.trim();
        if (line.startsWith('data: ')) {
          try {
            handleSSEEvent(JSON.parse(line.slice(6)));
          } catch { /* skip malformed */ }
        }
      }
    }
  } catch (err) {
    console.error('Pipeline error:', err);
  } finally {
    state.running = false;
    setRunBtn(false);
    loadHistory();
  }
}

function handleSSEEvent(ev) {
  if (ev.type === 'progress') {
    const s = state.stages[ev.stage - 1];
    s.progress_log.push(ev.msg);
    appendLogLine(ev.stage, ev.msg);
    // Digital Twin 단계별 시각화 페이즈 전환
    if (ev.stage === 4 && state.twinActive && twinVizInfoList.length) {
      const m = ev.msg;
      if (m.includes('⑤') && m.includes('[baseline]'))        setTwinPhase('baseline');
      else if (m.includes('⑥') && m.includes('FlowRule'))     setTwinPhase('deployed');
      else if (m.includes('⑦') && m.includes('[intent'))       setTwinPhase('intent');
      else if (m.includes('⑧') && m.includes('[regression]')) setTwinPhase('regression');
    }
  } else if (ev.type === 'stage') {
    const s = state.stages[ev.stage - 1];
    s.status = ev.status;
    if (ev.elapsed != null) s.elapsed = ev.elapsed;
    if (ev.result != null) s.result = ev.result;
    if (ev.error != null) s.result = { error: ev.error };
    // 카드가 없으면 먼저 생성 (단계적 등장)
    ensureStageCard(ev.stage);
    // 에러 단계는 자동으로 펼쳐서 즉시 확인 가능하게
    if (ev.status === 'error') s.expanded = true;
    // Digital Twin 단계: 실행 시 자동 확장 + 토폴로지 freeze 제어
    if (ev.stage === 4) {
      if (ev.status === 'running') {
        s.expanded = true;
        state.twinActive = true;
        twinVizInfoList = []; // 새 twin 실행 시 초기화
      } else {
        state.twinActive = false;
        stopTwinViz();
        // twin 종료 후 즉시 실제 토폴로지로 복원
        topoSnapshot = null;
        fetchTopology();
      }
    }
    renderStage(ev.stage - 1);
  } else if (ev.type === 'twin_info') {
    onTwinInfo(ev);
  } else if (ev.type === 'decision') {
    state.decision = ev.decision;
    state.decisionReport = ev.report;
    state.confidenceBreakdown = (ev.report && ev.report.confidence_breakdown) || {};
    // REJECT 시 실패한 단계 모두 자동 펼치기
    if (ev.decision === 'REJECT') {
      state.stages.forEach(s => {
        if (s.status === 'error' || (s.status === 'done' && s.result && !s.result.passed)) {
          s.expanded = true;
          renderStage(s.num - 1);
        }
      });
    }
    renderConfidenceBadges();
    renderDecision();
  }
}

// ── API Calls ─────────────────────────────────────────────────────────────────

// Last successful topology snapshot (JSON string for cheap diffing)
let topoSnapshot = null;

async function fetchTopology() {
  if (editor.active) return; // don't overwrite editor canvas
  try {
    const resp = await fetch('/api/topology');
    const data = await resp.json();

    if (data.error) {
      // ONOS 오프라인 — 이전 데이터 유지 (초기화하지 않음)
      if (!topoSnapshot) showTopoError(data.error);
      return;
    }

    // Digital Twin 실행 중: Mininet 가상 스위치가 ONOS에 연결되어
    // 토폴로지가 교란됨 → 표시 업데이트를 중단하고 이전 스냅샷 유지
    if (state.twinActive) return;

    // 변경 감지: nodes/links/flow_table/rule_count만 비교 (D3 좌표 제외)
    const key = JSON.stringify({
      nodes: data.nodes,
      links: data.links,
      flow_table: data.flow_table,
      rule_count: data.rule_count,
    });

    if (key === topoSnapshot) return; // 변경 없으면 렌더 스킵
    topoSnapshot = key;

    updateTopology(data);
    updateMetrics(data);
    updateHostLegend(data);
    updateFlowTable(data);
  } catch {
    // 네트워크 오류 — 이전 데이터 유지
  }
}

async function loadHistory() {
  try {
    const resp = await fetch('/api/logs');
    state.history = await resp.json();
    renderHistory();
  } catch { /* silent */ }
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function buildStageCards() {
  const section = document.getElementById('stages-section');
  section.style.display = 'none';
  section.innerHTML = '';
}

function ensureStageCard(stageNum) {
  const section = document.getElementById('stages-section');
  if (document.getElementById(`stage-${stageNum}`)) return;

  const i   = stageNum - 1;
  const def = STAGE_DEFS[i];
  const card = document.createElement('div');
  card.className = 'stage-card stage-card-enter';
  card.id = `stage-${def.num}`;
  const hasConf = def.num === 3 || def.num === 4;
  card.innerHTML = `
    <div class="stage-header" data-idx="${i}">
      <div class="stage-badge" id="badge-${def.num}">${def.num}</div>
      <div class="stage-name">${def.name}</div>
      <div class="stage-time" id="time-${def.num}">—</div>
      ${hasConf ? `<div class="stage-conf" id="conf-${def.num}" style="display:none"></div>` : ''}
      <div class="stage-icon" id="icon-${def.num}">${iconDot()}</div>
    </div>
    <div class="stage-progress" id="progress-${def.num}">
      <div class="stage-progress-bar" id="progress-bar-${def.num}"></div>
    </div>
    <div class="live-log" id="live-${def.num}"></div>
    <div class="stage-detail" id="detail-${def.num}"></div>
  `;
  card.querySelector('.stage-header').addEventListener('click', () => {
    state.stages[i].expanded = !state.stages[i].expanded;
    renderStage(i);
  });
  section.style.display = 'flex';
  section.appendChild(card);
  // Trigger animation
  requestAnimationFrame(() => card.classList.remove('stage-card-enter'));
}

function renderAllStages() {
  state.stages.forEach((_, i) => renderStage(i));
}

function renderStage(i) {
  const s = state.stages[i];
  const n = s.num;

  const card    = document.getElementById(`stage-${n}`);
  const badge   = document.getElementById(`badge-${n}`);
  const timeEl  = document.getElementById(`time-${n}`);
  const iconEl  = document.getElementById(`icon-${n}`);
  const liveEl  = document.getElementById(`live-${n}`);
  const detail  = document.getElementById(`detail-${n}`);
  const progBar = document.getElementById(`progress-bar-${n}`);

  if (!card) return;

  // Card border
  card.className = `stage-card${s.status === 'running' ? ' border-running' : s.status === 'error' ? ' border-error' : ''}`;

  // Badge
  badge.className = s.status === 'idle' ? 'stage-badge' : `stage-badge badge-${s.status}`;
  badge.textContent = n;

  // Time
  timeEl.textContent = s.elapsed != null ? `${s.elapsed}s` : '—';

  // Icon
  iconEl.innerHTML = statusIcon(s.status);

  // Progress bar
  if (progBar) {
    progBar.className = 'stage-progress-bar';
    if (s.status === 'running')  progBar.classList.add('bar-running');
    else if (s.status === 'done')    progBar.classList.add('bar-done');
    else if (s.status === 'error')   progBar.classList.add('bar-error');
    else if (s.status === 'skipped') progBar.classList.add('bar-skipped');
    // idle: no extra class → invisible
  }

  // Live log: running 중에만 표시, 완료 시 "current" 강조 해제
  if (liveEl) {
    if (s.status === 'running') {
      liveEl.style.display = 'block';
    } else {
      liveEl.style.display = 'none';
      // 완료 후 current 라인 일반화 (다음 실행 대비)
      liveEl.querySelectorAll('.log-line.current').forEach(el => {
        el.classList.remove('current');
        el.classList.add('done');
      });
    }
  }

  // Detail (클릭 확장)
  if (s.expanded && s.result) {
    detail.className = 'stage-detail open';
    detail.textContent = JSON.stringify(s.result, null, 2);
  } else {
    detail.className = 'stage-detail';
  }
}

function renderConfidenceBadges() {
  const map = { 3: 'static', 4: 'twin' };
  Object.entries(map).forEach(([stageNum, key]) => {
    const el = document.getElementById(`conf-${stageNum}`);
    if (!el) return;
    const score = state.confidenceBreakdown[key];
    if (score == null) { el.style.display = 'none'; return; }
    const pct = Math.round(score * 100);
    const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
    el.style.display = 'flex';
    el.style.color = color;
    el.style.borderColor = color + '40';
    el.textContent = `${pct}%`;
  });
}

function renderDecision() {
  const el = document.getElementById('decision-banner');
  if (!state.decision) { el.style.display = 'none'; return; }

  const approve = state.decision.includes('APPROVE');
  const color   = approve ? '#10b981' : '#ef4444';
  const bgColor = approve ? '#0f1c16' : '#1c0f0f';
  const icon    = approve
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a0e1a" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a0e1a" stroke-width="3"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>`;

  const report = state.decisionReport || {};
  // XAIReport.to_dict() fields: decision_reason, ir_summary, static_summary, twin_summary
  const reason = report.decision_reason || report.ir_summary || '';

  el.style.display = 'flex';
  el.style.background = bgColor;
  el.style.borderColor = color;
  el.innerHTML = `
    <div class="decision-icon" style="background:${color}">${icon}</div>
    <div>
      <div class="decision-title" style="color:${color}">${state.decision}</div>
      <div class="decision-reason">${reason}</div>
    </div>
  `;
}

function renderHistory() {
  const el = document.getElementById('history-list');
  if (!el) return;
  if (state.history.length === 0) {
    el.innerHTML = '<div style="font-size:11px;color:#4b5563;font-family:\'JetBrains Mono\',monospace">No runs yet</div>';
    return;
  }
  el.innerHTML = state.history.map(h => {
    const badge = h.decision
      ? `<span style="font-size:10px;color:${h.decision.includes('APPROVE') ? '#10b981' : '#ef4444'}">${h.decision.includes('APPROVE') ? '✓' : '✗'}</span> `
      : '';
    return `<div class="history-item" title="${h.intent}" data-intent="${escHtml(h.intent)}">${badge}${escHtml(h.intent)}</div>`;
  }).join('');
  el.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => fillIntent(item.dataset.intent));
  });
}

function updateMetrics(data) {
  const nodes = data.nodes || [];
  const links = data.links || [];
  const switches = nodes.filter(n => n.type === 'switch').length;
  const hosts    = nodes.filter(n => n.type === 'host').length;
  const swLinks  = links.filter(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    return s && t && s.startsWith('of:') && t.startsWith('of:');
  }).length;

  document.getElementById('metric-switches').textContent = switches || '—';
  document.getElementById('metric-hosts').textContent    = hosts    || '—';
  document.getElementById('metric-links').textContent    = swLinks  || '—';
  document.getElementById('metric-rules').textContent    = data.rule_count ?? '—';
}

function updateHostLegend(data) {
  const body = document.getElementById('host-legend-body');
  if (!body) return;
  const hosts = (data.nodes || []).filter(n => n.type === 'host' && n.ip);
  if (hosts.length === 0) {
    body.innerHTML = '<div style="color:#4b5563;font-size:11px;padding:4px 8px">No host info</div>';
    return;
  }
  body.innerHTML = hosts.map(h => {
    const label = h.label || h.id;
    const mac   = h.mac ? `<span class="host-legend-mac">${h.mac}</span>` : '';
    return `<div class="host-legend-row">
      <span class="host-legend-dot"></span>
      <span class="host-legend-label">${label}</span>
      <span class="host-legend-ip">${h.ip}</span>
      ${mac}
    </div>`;
  }).join('');
}

function updateFlowTable(data) {
  const body = document.getElementById('flow-table-body');
  const rows = data.flow_table || [];
  if (rows.length === 0) {
    body.innerHTML = `<div style="padding:12px 10px;font-size:11px;color:#4b5563;font-family:'JetBrains Mono',monospace">No flow rules</div>`;
    return;
  }
  body.innerHTML = rows.map(r => {
    const actionColor = r.action === 'FORWARD' ? '#10b981' : r.action === 'DROP' ? '#f59e0b' : '#9ca3af';
    return `
      <div class="flow-table-row">
        <div class="flow-cell-device">${escHtml(String(r.device))}</div>
        <div class="flow-cell-pri">${r.priority}</div>
        <div class="flow-cell-match">${escHtml(String(r.match))}</div>
        <div class="flow-cell-action" style="color:${actionColor}">
          <span class="flow-action-dot" style="background:${actionColor}"></span>
          ${escHtml(String(r.action))}
        </div>
      </div>`;
  }).join('');
}

function showTopoError(msg) {
  const el = document.getElementById('topology-placeholder');
  if (el) {
    el.style.display = 'flex';
    el.textContent = `ONOS offline — ${msg}`;
  }
}

// ── D3 Topology ───────────────────────────────────────────────────────────────

let topoSvg = null;
let topoZoom = null;
let topoZoomLayer = null;
let simulation = null;
const nodePositions = new Map(); // persist positions across refreshes
let currentTopoNodes = []; // snapshot for twin viz (id, type, label, ip)
let currentTopoLinks = []; // snapshot for twin viz (source, target as string IDs)
let twinVizInfoList = []; // [{ srcNode, dstNode, blockNode, action }, ...]
let twinVizPhase   = 'idle';
let twinAnimTimers = [];

// ── Topology Editor State ─────────────────────────────────────────────────────

const editor = {
  active: false,
  tool: 'select',   // 'select' | 'switch' | 'host' | 'link' | 'delete'
  linking: null,    // null | { sourceId }  — while drawing a link
  nodes: [],        // { id, label, type, dpid?, ip?, mac?, x, y }
  links: [],        // { id, source, target, bw? }
  selected: null,   // selected node id
  _cnt: { s: 1, h: 1, l: 1 },
};

const TOOL_HINTS = {
  select: '[Esc] Select · Drag to move · Shift+drag to lasso-delete',
  switch: '[S] Click canvas to add switch · Del=delete selected',
  host:   '[H] Click canvas to add host · Del=delete selected',
  link:   '[L] Click source node → click target node',
  delete: '[D] Click node/link · Shift+drag to delete area · Ctrl+Z undo',
};

function editorNewId(type) {
  // For switches and hosts: scan from 1 to find the first unused number.
  // This ensures new nodes start from s1/h1 even when existing ones are s5–s8.
  if (type === 'switch' || type === 'host') {
    const prefix = type === 'switch' ? 's' : 'h';
    const existingIds = new Set(editor.nodes.map(n => n.id));
    let n = 1;
    while (existingIds.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  }
  return `l${editor._cnt.l++}`;
}

// ── Editor: mode transitions ──────────────────────────────────────────────────

async function enterEditMode() {
  editor.active = true;
  console.log('[Editor] entering edit mode');

  const ids = ['topo-title', 'live-mode-controls', 'topo-editor-bar',
                'metrics-grid', 'flow-table-section', 'topo-props-panel'];
  for (const id of ids) {
    if (!document.getElementById(id)) {
      console.error(`[Editor] missing element: #${id}`);
    }
  }

  document.getElementById('topo-title').textContent = 'Topology Editor';
  document.getElementById('live-mode-controls').style.display = 'none';
  document.getElementById('topo-editor-bar').style.display = 'flex';
  document.getElementById('metrics-grid').style.display = 'none';
  document.getElementById('flow-table-section').style.display = 'none';
  document.getElementById('topo-props-panel').style.display = 'block';

  clearTopologyGraph();
  await loadEditorData();
  setEditorTool('select');
  renderEditorGraph();
  console.log('[Editor] ready — nodes:', editor.nodes.length, 'links:', editor.links.length);
}

function exitEditMode() {
  editor.active = false;
  editor.linking = null;
  editor.selected = null;

  document.getElementById('topo-title').textContent = 'Live Network Topology';
  document.getElementById('live-mode-controls').style.display = 'flex';
  document.getElementById('topo-editor-bar').style.display = 'none';
  document.getElementById('metrics-grid').style.display = 'grid';
  document.getElementById('flow-table-section').style.display = 'block';
  document.getElementById('topo-props-panel').style.display = 'none';

  clearTopologyGraph();
  topoSnapshot = null;

  // Render immediately from editor state so the user sees their topology
  // right away without waiting for the ONOS connection attempt to time out.
  // _renderEditorSnapshot() sets topoSnapshot — we deliberately keep it
  // so fetchTopology() doesn't call showTopoError() on ONOS-offline errors.
  _renderEditorSnapshot();
  fetchTopology();
}

// Render the current editor.nodes / editor.links as a static live graph.
// Positions are preserved from the editor (x/y), so the layout matches.
function _renderEditorSnapshot() {
  if (!editor.nodes.length) return;

  const nodes = editor.nodes.map(n => ({
    id: n.id, label: n.label, type: n.type, state: 'idle',
    ip: n.ip || '', x: n.x, y: n.y,
  }));
  const links = editor.links.map(l => ({ source: l.source, target: l.target }));
  const data = { nodes, links, flow_table: [], rule_count: nodes.length };

  // Store snapshot so the next fetchTopology() only re-renders if data changed
  topoSnapshot = JSON.stringify({
    nodes: data.nodes, links: data.links,
    flow_table: [], rule_count: data.rule_count,
  });

  updateTopology(data);
  updateMetrics(data);
  updateHostLegend(data);
  updateFlowTable(data);
}

function clearTopologyGraph() {
  if (!topoSvg || !topoZoomLayer) return;
  if (simulation) { simulation.stop(); simulation = null; }
  topoZoomLayer.select('.links').selectAll('*').remove();
  topoZoomLayer.select('.nodes').selectAll('*').remove();
  topoSvg.selectAll('#ghost-link').remove();
  topoSvg.selectAll('#lasso-rect').remove();
  topoSvg.on('click', null).on('mousemove', null)
         .on('mousedown.lasso', null).on('mouseup.lasso', null);
  lasso.active = false;
}

// ── Editor: data loading ──────────────────────────────────────────────────────

async function loadEditorData() {
  try {
    const resp = await fetch('/api/topology/custom');
    if (!resp.ok) throw new Error('no custom topology');
    const data = await resp.json();
    if ((data.switches || []).length > 0 || (data.hosts || []).length > 0) {
      importCustomData(data);
      return;
    }
  } catch { /* fall through */ }
  loadDefaultDiamond();
}

function importCustomData(data) {
  const allSw = (data.switches || []);
  const allH  = (data.hosts   || []);
  // _cnt.s/_cnt.h are no longer used for switch/host IDs (editorNewId scans from 1).
  // Keep _cnt.l for link IDs since those are internal-only.
  editor._cnt.l = (data.links || []).length + 1;

  editor.nodes = [
    ...allSw.map(sw => ({
      id: sw.id, label: sw.label || sw.id, type: 'switch',
      dpid: sw.dpid, x: sw.x ?? 150, y: sw.y ?? 140,
    })),
    ...allH.map(h => ({
      id: h.id, label: h.label || h.id, type: 'host',
      ip: h.ip, mac: h.mac, x: h.x ?? 80, y: h.y ?? 80,
    })),
  ];
  editor.links = (data.links || []).map(l => ({
    id: l.id || editorNewId('link'),
    source: l.source, target: l.target, bw: l.bw,
  }));
}

function loadDefaultDiamond() {
  editor._cnt = { s: 5, h: 5, l: 9 };
  const cx = 171, cy = 140;
  editor.nodes = [
    { id: 's1', label: 'S1', type: 'switch', dpid: '0000000000000001', x: cx - 55, y: cy - 45 },
    { id: 's2', label: 'S2', type: 'switch', dpid: '0000000000000002', x: cx - 75, y: cy + 40 },
    { id: 's3', label: 'S3', type: 'switch', dpid: '0000000000000003', x: cx + 75, y: cy + 40 },
    { id: 's4', label: 'S4', type: 'switch', dpid: '0000000000000004', x: cx + 55, y: cy - 45 },
    { id: 'h1', label: 'H1', type: 'host', ip: '10.0.0.1', mac: '00:00:00:00:00:01', x: cx - 130, y: cy - 70 },
    { id: 'h2', label: 'H2', type: 'host', ip: '10.0.0.2', mac: '00:00:00:00:00:02', x: cx - 135, y: cy + 15 },
    { id: 'h3', label: 'H3', type: 'host', ip: '10.0.0.3', mac: '00:00:00:00:00:03', x: cx + 135, y: cy + 15 },
    { id: 'h4', label: 'H4', type: 'host', ip: '10.0.0.4', mac: '00:00:00:00:00:04', x: cx + 130, y: cy - 70 },
  ];
  editor.links = [
    { id: 'l1', source: 'h1', target: 's1', bw: 100 },
    { id: 'l2', source: 'h2', target: 's1', bw: 100 },
    { id: 'l3', source: 'h3', target: 's4', bw: 100 },
    { id: 'l4', source: 'h4', target: 's4', bw: 100 },
    { id: 'l5', source: 's1', target: 's2', bw: 1   },
    { id: 'l6', source: 's2', target: 's4', bw: 1   },
    { id: 'l7', source: 's1', target: 's3', bw: 10  },
    { id: 'l8', source: 's3', target: 's4', bw: 10  },
  ];
}

// ── Editor: tool selection ────────────────────────────────────────────────────

function setEditorTool(tool) {
  editor.tool = tool;
  editor.linking = null;
  if (topoSvg) {
    topoZoomLayer.select('#ghost-link').attr('opacity', 0);
    const cur = { select: 'default', switch: 'crosshair', host: 'crosshair', link: 'crosshair', delete: 'not-allowed' };
    topoSvg.style('cursor', cur[tool] || 'default');
  }
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  const hint = document.getElementById('tool-hint');
  if (hint) hint.textContent = TOOL_HINTS[tool] || '';
}

// ── Editor: D3 rendering ──────────────────────────────────────────────────────

function renderEditorGraph() {
  if (!editor.active) return;
  if (!topoSvg) initTopology();

  const container = document.getElementById('topology-graph');
  const W = container.clientWidth  || 342;
  const H = container.clientHeight || 280;

  const ph = document.getElementById('topology-placeholder');
  if (ph) ph.style.display = 'none';

  // Ghost link (drawn above everything)
  if (topoZoomLayer.select('#ghost-link').empty()) {
    topoZoomLayer.append('line')
      .attr('id', 'ghost-link')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,4')
      .attr('opacity', 0)
      .attr('pointer-events', 'none');
  }

  // Lasso rect (Shift+drag delete) — stays outside zoom so it covers screen coords
  if (topoSvg.select('#lasso-rect').empty()) {
    topoSvg.insert('rect', ':first-child')
      .attr('id', 'lasso-rect')
      .attr('opacity', 0);
  }

  // SVG background interactions
  topoSvg.on('click', function(ev) {
    if (!editor.active) return;
    if (ev.target !== this) return;
    const t = d3.zoomTransform(topoSvg.node());
    const [px, py] = d3.pointer(ev);
    const [x, y] = t.invert([px, py]);
    if (editor.tool === 'switch') {
      editorAddNode('switch', x, y);
    } else if (editor.tool === 'host') {
      editorAddNode('host', x, y);
    } else if (editor.tool === 'link' && editor.linking) {
      editor.linking = null;
      topoZoomLayer.select('#ghost-link').attr('opacity', 0);
      renderEditorGraph();
    } else {
      editor.selected = null;
      renderPropsPanel();
      renderEditorGraph();
    }
  });

  topoSvg.on('mousemove', function(ev) {
    const [mx, my] = d3.pointer(ev);
    if (lasso.active) {
      lasso.x1 = mx; lasso.y1 = my;
      updateLassoRect();
    }
    if (!editor.active || editor.tool !== 'link' || !editor.linking) return;
    const src = editor.nodes.find(n => n.id === editor.linking.sourceId);
    if (!src) return;
    const t = d3.zoomTransform(topoSvg.node());
    const [ix, iy] = t.invert([mx, my]);
    topoZoomLayer.select('#ghost-link')
      .attr('x1', src.x).attr('y1', src.y)
      .attr('x2', ix).attr('y2', iy)
      .attr('opacity', 1);
  });

  topoSvg.on('mousedown.lasso', function(ev) {
    if (!editor.active || !ev.shiftKey) return;
    if (!isEditorBg(ev)) return;
    ev.preventDefault();
    const [x, y] = d3.pointer(ev);
    lasso.active = true;
    lasso.x0 = lasso.x1 = x;
    lasso.y0 = lasso.y1 = y;
    updateLassoRect();
  });

  topoSvg.on('mouseup.lasso', function() {
    if (!lasso.active) return;
    lasso.active = false;
    topoSvg.select('#lasso-rect').attr('opacity', 0);
    commitLasso();
  });

  // ── Links ──
  const linkGs = topoZoomLayer.select('.links')
    .selectAll('g.ed-link')
    .data(editor.links, d => d.id)
    .join(enter => {
      const g = enter.append('g').attr('class', 'ed-link').style('cursor', 'pointer');
      g.append('line').attr('class', 'lhit').attr('stroke', 'transparent').attr('stroke-width', 8);
      g.append('line').attr('class', 'lvis').attr('stroke-width', 1.5);
      g.append('text').attr('class', 'lbw')
        .attr('text-anchor', 'middle').attr('font-size', 9)
        .attr('font-family', 'JetBrains Mono, monospace').attr('fill', '#6b7280');
      return g;
    });

  linkGs.each(function(d) {
    const src = editor.nodes.find(n => n.id === d.source);
    const tgt = editor.nodes.find(n => n.id === d.target);
    if (!src || !tgt) return;
    const mx = (src.x + tgt.x) / 2, my = (src.y + tgt.y) / 2;
    const isDel = editor.tool === 'delete';
    const g = d3.select(this);
    g.select('.lhit').attr('x1', src.x).attr('y1', src.y).attr('x2', tgt.x).attr('y2', tgt.y);
    g.select('.lvis')
      .attr('x1', src.x).attr('y1', src.y).attr('x2', tgt.x).attr('y2', tgt.y)
      .attr('stroke', isDel ? '#ef444488' : '#374151');
    g.select('.lbw').attr('x', mx).attr('y', my - 5).text(d.bw != null ? `${d.bw}M` : '');
  });

  linkGs.on('click', (ev, d) => {
    ev.stopPropagation();
    if (editor.tool === 'delete') {
      editorPushHistory();
      editor.links = editor.links.filter(l => l.id !== d.id);
      renderEditorGraph();
    }
  });

  // ── Nodes ──
  const drag = d3.drag()
    .filter(ev => !ev.shiftKey)  // Shift+drag → lasso, not node drag
    .on('start', (ev, d) => { if (editor.tool !== 'select') ev.sourceEvent.stopPropagation(); })
    .on('drag',  (ev, d) => {
      if (editor.tool !== 'select') return;
      d.x = Math.max(18, Math.min(W - 18, ev.x));
      d.y = Math.max(18, Math.min(H - 18, ev.y));
      renderEditorGraph();
    });

  const nodeGs = topoZoomLayer.select('.nodes')
    .selectAll('g.ed-node')
    .data(editor.nodes, d => d.id)
    .join(enter => enter.append('g').attr('class', 'ed-node'))
    .call(drag);

  nodeGs.selectAll('*').remove();

  nodeGs.each(function(d) {
    const g = d3.select(this);
    const sel  = editor.selected === d.id;
    const lsrc = editor.linking?.sourceId === d.id;
    const fill = lsrc ? '#1e3a5f' : nodeColor(d);
    const strokeColor = sel ? '#60a5fa' : lsrc ? '#3b82f6' : (d.type === 'switch' ? '#0a0e1a' : '#3b82f6');
    const strokeW = sel ? 2.5 : 1.5;

    if (d.type === 'switch') {
      g.append('polygon')
        .attr('points', '0,-15 13,-7.5 13,7.5 0,15 -13,7.5 -13,-7.5')
        .attr('fill', fill)
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeW);
    } else {
      g.append('circle')
        .attr('r', 10)
        .attr('fill', '#111827')
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeW);
    }

    g.append('text')
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('font-size', 9).attr('font-weight', '700')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', d.type === 'switch' ? (lsrc ? '#60a5fa' : '#0a0e1a') : '#f9fafb')
      .attr('pointer-events', 'none')
      .text(d.label);

    g.attr('transform', `translate(${d.x},${d.y})`)
      .style('cursor', editor.tool === 'delete' ? 'not-allowed' : editor.tool === 'select' ? 'grab' : 'pointer');
  });

  nodeGs.on('click', (ev, d) => {
    ev.stopPropagation();
    handleEditorNodeClick(d);
  });

  // Keep ghost link on top
  topoZoomLayer.select('#ghost-link').raise();
}

function handleEditorNodeClick(d) {
  if (editor.tool === 'delete') {
    editorPushHistory();
    editor.nodes = editor.nodes.filter(n => n.id !== d.id);
    editor.links = editor.links.filter(l => l.source !== d.id && l.target !== d.id);
    if (editor.selected === d.id) editor.selected = null;
    renderEditorGraph();
    renderPropsPanel();
    return;
  }

  if (editor.tool === 'link') {
    if (!editor.linking) {
      editor.linking = { sourceId: d.id };
      renderEditorGraph();
    } else if (editor.linking.sourceId === d.id) {
      // Cancel link on same node
      editor.linking = null;
      topoZoomLayer.select('#ghost-link').attr('opacity', 0);
      renderEditorGraph();
    } else {
      // Complete link — prevent duplicates
      const a = editor.linking.sourceId, b = d.id;
      const dup = editor.links.some(l =>
        (l.source === a && l.target === b) || (l.source === b && l.target === a)
      );
      if (!dup) {
        editorPushHistory();
        const bw = (editor.nodes.find(n=>n.id===a)?.type === 'switch' &&
                    editor.nodes.find(n=>n.id===b)?.type === 'switch') ? 10 : 100;
        editor.links.push({ id: editorNewId('link'), source: a, target: b, bw });
      }
      editor.linking = null;
      topoZoomLayer.select('#ghost-link').attr('opacity', 0);
      renderEditorGraph();
    }
    return;
  }

  // Select tool
  editor.selected = d.id;
  renderPropsPanel();
  renderEditorGraph();
}

function editorAddNode(type, x, y) {
  editorPushHistory();
  const id  = editorNewId(type);
  const num = parseInt(id.replace(/\D/g, ''), 10);
  const node = { id, label: type === 'switch' ? `S${num}` : `H${num}`, type, x, y };
  if (type === 'switch') {
    node.dpid = `0000000000000000${num}`.slice(-16);
  } else {
    node.ip  = `10.0.0.${num}`;
    node.mac = `00:00:00:00:00:${`0${num}`.slice(-2)}`;
  }
  editor.nodes.push(node);
  editor.selected = id;
  renderEditorGraph();
  renderPropsPanel();
}

// ── Editor: properties panel ──────────────────────────────────────────────────

function renderPropsPanel() {
  const panel = document.getElementById('props-content');
  if (!panel) return;

  const node = editor.nodes.find(n => n.id === editor.selected);
  if (!node) {
    panel.innerHTML = `<div class="props-hint">Click a node to edit its properties</div>`;
    return;
  }

  const swFields  = [{ k:'label', l:'Label' }, { k:'dpid', l:'DPID (16 hex digits)' }];
  const hostFields = [{ k:'label', l:'Label' }, { k:'ip', l:'IP Address' }, { k:'mac', l:'MAC Address' }];
  const fields = node.type === 'switch' ? swFields : hostFields;

  // Connected links for this node
  const connLinks = editor.links.filter(l => l.source === node.id || l.target === node.id);
  const linkRows = connLinks.length > 0
    ? connLinks.map(l => {
        const peerId = l.source === node.id ? l.target : l.source;
        const peer = editor.nodes.find(n => n.id === peerId);
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="font-size:11px;color:#9ca3af;flex:1">${peer?.label ?? peerId}</span>
          <input class="props-input link-bw-input" data-lid="${l.id}" value="${l.bw ?? ''}"
            style="width:60px;text-align:right" placeholder="Mbps" />
          <span style="font-size:10px;color:#4b5563">M</span>
          <button class="props-delete-btn" data-lid="${l.id}"
            style="width:auto;margin:0;padding:3px 6px;font-size:10px">✕</button>
        </div>`;
      }).join('')
    : `<div class="props-hint">No connected links</div>`;

  panel.innerHTML = `
    ${fields.map(f => `
      <div class="props-field">
        <div class="props-field-label">${f.l}</div>
        <input class="props-input" data-key="${f.k}" value="${escHtml(node[f.k] || '')}" />
      </div>`).join('')}
    <div class="props-section-title">Links</div>
    ${linkRows}
    <button id="props-delete-node-btn" class="props-delete-btn">Delete ${node.type === 'switch' ? 'Switch' : 'Host'}</button>
  `;

  // Node field changes
  panel.querySelectorAll('.props-input[data-key]').forEach(inp => {
    inp.addEventListener('input', ev => {
      const n = editor.nodes.find(x => x.id === editor.selected);
      if (n) { n[ev.target.dataset.key] = ev.target.value; renderEditorGraph(); }
    });
  });

  // Link bw changes
  panel.querySelectorAll('.link-bw-input').forEach(inp => {
    inp.addEventListener('input', ev => {
      const lnk = editor.links.find(l => l.id === ev.target.dataset.lid);
      if (lnk) { lnk.bw = Number(ev.target.value) || null; renderEditorGraph(); }
    });
  });

  // Link delete buttons
  panel.querySelectorAll('button[data-lid]').forEach(btn => {
    btn.addEventListener('click', () => {
      editorPushHistory();
      editor.links = editor.links.filter(l => l.id !== btn.dataset.lid);
      renderEditorGraph();
      renderPropsPanel();
    });
  });

  // Node delete
  document.getElementById('props-delete-node-btn')?.addEventListener('click', () => {
    editorPushHistory();
    editor.nodes = editor.nodes.filter(n => n.id !== editor.selected);
    editor.links = editor.links.filter(l => l.source !== editor.selected && l.target !== editor.selected);
    editor.selected = null;
    renderEditorGraph();
    renderPropsPanel();
  });
}

// ── Editor: apply / save ──────────────────────────────────────────────────────

async function applyTopology() {
  const payload = {
    switches: editor.nodes
      .filter(n => n.type === 'switch')
      .map(n => ({ id: n.id, label: n.label, dpid: n.dpid, x: Math.round(n.x), y: Math.round(n.y) })),
    hosts: editor.nodes
      .filter(n => n.type === 'host')
      .map(n => ({ id: n.id, label: n.label, ip: n.ip, mac: n.mac, x: Math.round(n.x), y: Math.round(n.y) })),
    links: editor.links.map(l => ({ id: l.id, source: l.source, target: l.target, bw: l.bw })),
  };

  // Show "Applying..." in the apply button
  const applyBtn = document.getElementById('topo-apply-btn');
  const origText = applyBtn.textContent;
  applyBtn.textContent = 'Applying…';
  applyBtn.disabled = true;

  try {
    // 1. Save topology file
    await fetch('/api/topology/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 2. Push to ONOS netcfg (best-effort — ONOS may be offline)
    let onosMsg = '';
    try {
      const applyRes = await fetch('/api/topology/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const applyData = await applyRes.json();
      if (applyData.ok) {
        const d = applyData.pushed || {};
        onosMsg = `ONOS synced (${d.devices ?? 0} devices, ${d.hosts ?? 0} hosts)`;
      } else {
        onosMsg = `ONOS offline — topology saved locally (${applyData.error || ''})`;
      }
    } catch (_) {
      onosMsg = 'ONOS offline — topology saved locally';
    }

    updateExampleChips(payload);
    exitEditMode();

    // Show brief status in topology title
    const titleEl = document.getElementById('topo-title');
    if (titleEl) {
      const prev = titleEl.textContent;
      titleEl.textContent = onosMsg;
      setTimeout(() => { titleEl.textContent = prev; }, 4000);
    }
  } catch (err) {
    console.error('Failed to apply topology:', err);
    applyBtn.textContent = 'Error';
    setTimeout(() => {
      applyBtn.textContent = origText;
      applyBtn.disabled = false;
    }, 2000);
    return;
  }

  applyBtn.textContent = origText;
  applyBtn.disabled = false;
}

function updateExampleChips(topo) {
  const hosts = topo.hosts || [];
  const switches = topo.switches || [];
  if (hosts.length < 2 || switches.length < 1) return;

  const h1 = hosts[0];
  const h2 = hosts[hosts.length - 1];
  const s1 = switches[0];
  const swLabel = s1.label?.toLowerCase() ?? s1.id;
  const swPhrase = `switch ${swLabel.replace(/\D/g, '') || 1}`;

  const sw2 = switches.length >= 2 ? switches[1] : s1;
  const sw2Phrase = `switch ${sw2.label?.toLowerCase().replace(/\D/g, '') || 2}`;
  const sw3 = switches.length >= 3 ? switches[2] : s1;
  const sw3Phrase = `switch ${sw3.label?.toLowerCase().replace(/\D/g, '') || 3}`;

  const swNum  = swLabel.replace(/\D/g, '') || 1;
  const sw2Num = sw2.label?.replace(/\D/g, '') || 2;
  const sw3Num = sw3.label?.replace(/\D/g, '') || 3;
  const swLast = switches[switches.length - 1].label?.replace(/\D/g, '') || switches.length;

  const chips = [
    { t: `Block ${h1.ip}→${h2.ip}`,
      i: `Block all traffic from ${h1.ip} to ${h2.ip} on ${swPhrase}`,
      k: `[차단] 스위치 ${swNum}에서 ${h1.ip} → ${h2.ip} 모든 트래픽을 드롭합니다.` },
    { t: `Block SSH to ${h1.ip}`,
      i: `Block TCP traffic on port 22 destined for ${h1.ip} on ${swPhrase}`,
      k: `[차단] 스위치 ${swNum}에서 ${h1.ip}로 향하는 SSH(TCP:22) 트래픽을 차단합니다.` },
    { t: `Forward ICMP→${h1.ip}`,
      i: `Forward ICMP traffic destined for ${h1.ip} through port 3 on ${swPhrase}`,
      k: `[전달] 스위치 ${swNum}에서 ${h1.ip}로 향하는 ICMP(ping) 트래픽을 포트 3으로 내보냅니다.` },
    { t: `Forward HTTP→${h2.ip}`,
      i: `Forward TCP traffic on port 80 destined for ${h2.ip} via port 2 on ${swPhrase}`,
      k: `[전달] 스위치 ${swNum}에서 ${h2.ip}:80(HTTP)으로 향하는 TCP 트래픽을 포트 2로 내보냅니다.` },
  ];
  if (hosts.length >= 4) {
    const h3 = hosts[2], h4 = hosts[3];
    chips.push({
      t: `QoS ${h1.ip}→${h4.ip}`,
      i: `Apply QoS for video streaming from ${h1.ip} to ${h4.ip} on ${swPhrase}`,
      k: `[QoS] 스위치 ${swNum}에서 ${h1.ip} → ${h4.ip} 영상 스트리밍 트래픽에 우선순위 큐를 적용합니다.`,
    });
    chips.push({
      t: `Block ${h3.ip}→${h4.ip}`,
      i: `Block all traffic from ${h3.ip} to ${h4.ip} on switch ${swLast}`,
      k: `[차단] 스위치 ${swLast}에서 ${h3.ip} → ${h4.ip} 모든 트래픽을 드롭합니다.`,
    });
    chips.push({
      t: `SFC: IDS ${h1.ip}→${h4.ip}`,
      i: `Steer HTTP traffic from ${h1.ip} to ${h4.ip} through IDS at port 9, then forward out port 2 on ${sw2Phrase}`,
      k: `[SFC] 스위치 ${sw2Num}에서 ${h1.ip}→${h4.ip} HTTP 트래픽을 포트 9의 IDS로 검사한 뒤, 포트 2로 목적지에 전달합니다.`,
    });
    chips.push({
      t: `Reroute via ${sw3.label || 's3'}`,
      i: `Reroute traffic from ${h2.ip} to ${h3.ip} via ${sw3Phrase} avoiding ${sw2Phrase} on ${swPhrase}`,
      k: `[재경로] 스위치 ${swNum}에서 ${h2.ip}→${h3.ip} 트래픽을 스위치 ${sw2Num}을 우회하여 스위치 ${sw3Num} 경로로 재지정합니다.`,
    });
    chips.push({
      t: `Compound: Allow HTTP, Block SSH`,
      i: `Allow HTTP from ${h1.ip} to ${h2.ip} via port 2 on ${swPhrase}, but block SSH from ${h1.ip} to ${h2.ip} on ${swPhrase}`,
      k: `[복합] ${swPhrase}에서 ${h1.ip}→${h2.ip} HTTP(TCP:80)는 포트 2로 허용하고, SSH(TCP:22)는 차단합니다.`,
    });
    chips.push({
      t: `Compound: Multi-switch rules`,
      i: `Forward HTTP from ${h1.ip} to ${h3.ip} via port 2 on ${swPhrase}, and block all traffic from ${h2.ip} to ${h4.ip} on ${sw2Phrase}`,
      k: `[복합] ${swPhrase}에서 ${h1.ip}→${h3.ip} HTTP를 포트 2로 전달하고, ${sw2Phrase}에서 ${h2.ip}→${h4.ip}를 차단합니다.`,
    });
  }

  // Update the dynamic section in the intent preset menu
  const menu = document.getElementById('intent-preset-menu');
  if (!menu) return;
  // Remove existing dynamic items (all items after first static group)
  menu.querySelectorAll('.dynamic-preset-item, .dynamic-preset-label').forEach(el => el.remove());

  if (chips.length === 0) return;
  const label = document.createElement('div');
  label.className = 'preset-group-label dynamic-preset-label';
  label.textContent = 'Current Topology';
  menu.appendChild(label);
  chips.forEach(c => {
    const item = document.createElement('div');
    item.className = 'preset-item dynamic-preset-item';
    item.textContent = c.t;
    item.addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.remove('open');
      fillIntent(c.i, c.k);
    });
    menu.appendChild(item);
  });
}

function initTopology() {
  const container = document.getElementById('topology-graph');
  const w = container.clientWidth  || 342;
  const h = container.clientHeight || 280;

  topoSvg = d3.select('#topology-graph')
    .append('svg')
    .attr('width',  '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${w} ${h}`);

  topoZoomLayer = topoSvg.append('g').attr('class', 'zoom-layer');
  topoZoomLayer.append('g').attr('class', 'links');
  topoZoomLayer.append('g').attr('class', 'nodes');

  topoZoom = d3.zoom()
    .scaleExtent([0.2, 4])
    .on('zoom', ev => topoZoomLayer.attr('transform', ev.transform));

  topoSvg.call(topoZoom);

  // Double-click to reset zoom
  topoSvg.on('dblclick.zoom', () => {
    topoSvg.transition().duration(300).call(topoZoom.transform, d3.zoomIdentity);
  });
}

function updateTopology(data) {
  if (!topoSvg) initTopology();

  const placeholder = document.getElementById('topology-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  const { nodes, links } = data;
  // Snapshot for twin visualization (before D3 mutates objects)
  currentTopoNodes = (data.nodes || []).map(n => ({ id: n.id, type: n.type, label: n.label || '', ip: n.ip || null }));
  currentTopoLinks = (data.links || []).map(l => ({ source: String(l.source), target: String(l.target) }));
  if (!nodes || nodes.length === 0) {
    showTopoError('No devices found');
    return;
  }

  const container = document.getElementById('topology-graph');
  const w = container.clientWidth  || 342;
  const h = container.clientHeight || 280;

  // Always sync viewBox to current container size (handles fullscreen transitions)
  topoSvg.attr('viewBox', `0 0 ${w} ${h}`);

  // Seed positions: prefer stored positions, then backend-provided x/y
  nodes.forEach(n => {
    const prev = nodePositions.get(n.id);
    if (prev) { n.x = prev.x; n.y = prev.y; }
    else if (n.x != null && n.y != null) {
      nodePositions.set(n.id, { x: n.x, y: n.y }); // cache backend coords
    }
  });

  if (simulation) simulation.stop();

  simulation = d3.forceSimulation(nodes)
    .force('link',      d3.forceLink(links).id(d => d.id).distance(70))
    .force('charge',    d3.forceManyBody().strength(-180))
    .force('center',    d3.forceCenter(w / 2, h / 2))
    .force('collision', d3.forceCollide(24));

  // Links
  const link = topoZoomLayer.select('.links')
    .selectAll('line')
    .data(links, d => `${d.source?.id ?? d.source}-${d.target?.id ?? d.target}`)
    .join('line')
    .attr('stroke', '#374151')
    .attr('stroke-width', 1.5);

  // Nodes
  const drag = d3.drag()
    .on('start', (ev, d) => {
      if (!ev.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    })
    .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
    .on('end',  (ev, d) => {
      if (!ev.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    });

  const nodeG = topoZoomLayer.select('.nodes')
    .selectAll('g.live-node')
    .data(nodes, d => d.id)
    .join(enter => enter.append('g').attr('class', 'live-node'))
    .call(drag);

  nodeG.selectAll('*').remove();

  nodeG.each(function(d) {
    const g = d3.select(this);
    const fill = nodeColor(d);

    if (d.type === 'switch') {
      g.append('polygon')
        .attr('points', '0,-15 13,-7.5 13,7.5 0,15 -13,7.5 -13,-7.5')
        .attr('fill', fill)
        .attr('stroke', '#0a0e1a')
        .attr('stroke-width', 1.5);
    } else {
      g.append('circle')
        .attr('r', 10)
        .attr('fill', '#111827')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2);
    }

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', 9)
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', d.type === 'switch' ? '#0a0e1a' : '#f9fafb')
      .attr('font-weight', '700')
      .attr('pointer-events', 'none')
      .text(d.label);
  });

  simulation.on('tick', () => {
    // Read live container size each tick so clamp follows panel resizes
    const topoEl = document.getElementById('topology-graph');
    const cw = topoEl ? topoEl.clientWidth  : w;
    const ch = topoEl ? topoEl.clientHeight : h;
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    nodeG.attr('transform', d => {
      // clamp to svg bounds
      const x = Math.max(20, Math.min(cw - 20, d.x));
      const y = Math.max(20, Math.min(ch - 20, d.y));
      // Update continuously (not just on 'end') so twin packet paths
      // stay accurate while the user drags nodes
      nodePositions.set(d.id, { x, y });
      return `translate(${x},${y})`;
    });
  });

  simulation.on('end', () => {
    nodes.forEach(n => nodePositions.set(n.id, { x: n.x, y: n.y }));
  });
}

function nodeColor(d) {
  if (d.type === 'host') return '#3b82f6';
  return { forward: '#10b981', drop: '#f59e0b', offline: '#ef4444', idle: '#6b7280' }[d.state] || '#6b7280';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusIcon(status) {
  if (status === 'done')
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (status === 'running')
    return `<svg width="16" height="16" viewBox="0 0 24 24" style="animation:spin 1s linear infinite"><circle cx="12" cy="12" r="9" fill="none" stroke="#1f2937" stroke-width="3"/><path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/></svg>`;
  if (status === 'error')
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>`;
  if (status === 'skipped')
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  return iconDot();
}

function iconDot() {
  return `<div style="width:8px;height:8px;border-radius:50%;background:#374151;margin:auto"></div>`;
}

function appendLogLine(stageNum, msg) {
  const el = document.getElementById(`live-${stageNum}`);
  if (!el) return;

  // 이전 current 라인 → done으로 강등
  const prev = el.querySelector('.log-line.current');
  if (prev) {
    prev.classList.remove('current');
    prev.classList.add('done');
  }

  // 새 라인 → current로 추가
  const line = document.createElement('div');
  line.className = 'log-line current';
  if (msg.startsWith('✓')) line.classList.add('log-ok');
  else if (msg.startsWith('✗')) line.classList.add('log-fail');
  else if (msg.startsWith('⚠')) line.classList.add('log-warn');
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function fillIntent(text, kr) {
  state.intent = text;
  document.getElementById('intent-input').value = text;
  if (kr) showIntentTranslation(kr);
  else hideIntentTranslation();
}

function showIntentTranslation(kr) {
  const el = document.getElementById('intent-translation');
  el.innerHTML = `<div class="kr-label">한국어 설명</div>${escHtml(kr)}`;
  el.classList.add('visible');
}

function hideIntentTranslation() {
  const el = document.getElementById('intent-translation');
  if (el) el.classList.remove('visible');
}

function setRunBtn(running) {
  const btn = document.getElementById('run-btn');
  btn.disabled = running;
  btn.innerHTML = running
    ? `<svg width="14" height="14" viewBox="0 0 24 24" style="animation:spin 1s linear infinite"><circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="3"/><path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/></svg> Running...`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Run Pipeline`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Topology Refresh Countdown ────────────────────────────────────────────────

let topoFetching = false;

function startRefreshLoop() {
  async function tick() {
    if (!topoFetching) {
      topoFetching = true;
      await fetchTopology();
      topoFetching = false;
    }
    setTimeout(tick, 1000);
  }
  tick();
}

// ── Digital Twin Visualization ────────────────────────────────────────────────

function highlightPath(pathIds, color) {
  if (!topoSvg) return;
  clearPathHighlight();
  const linkSel = topoZoomLayer.select('.links').selectAll('line');
  for (let i = 0; i < pathIds.length - 1; i++) {
    const a = pathIds[i], b = pathIds[i + 1];
    linkSel.filter(d => {
      const s = String(typeof d.source === 'object' ? d.source.id : d.source);
      const t = String(typeof d.target === 'object' ? d.target.id : d.target);
      return (s === a && t === b) || (s === b && t === a);
    })
    .classed('path-active', true)
    .attr('stroke', color)
    .attr('stroke-width', 3)
    .attr('stroke-opacity', 0.75);
  }
}

function clearPathHighlight() {
  if (!topoSvg) return;
  topoZoomLayer.select('.links').selectAll('line.path-active')
    .classed('path-active', false)
    .attr('stroke', '#374151')
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 1);
}

function stopTwinViz() {
  twinAnimTimers.forEach(t => clearTimeout(t));
  twinAnimTimers = [];
  clearPathHighlight();
  if (topoSvg) {
    topoSvg.selectAll('.twin-viz').remove();
    topoSvg.selectAll('.twin-node-indicator').remove();
  }
  twinVizInfoList = [];
  twinVizPhase    = 'idle';
}

function onTwinInfo(ev) {
  // host: IP 로 찾기
  const srcNode   = currentTopoNodes.find(n => n.type === 'host'   && n.ip === ev.src_ip) || null;
  const dstNode   = currentTopoNodes.find(n => n.type === 'host'   && n.ip === ev.dst_ip) || null;
  // switch: device_id "of:0000000000000001" → switchNum=1 → label "S1"
  let blockNode = null;
  if (ev.device_id) {
    const swNum  = parseInt(ev.device_id.replace('of:', ''), 16);
    const swLabel = `S${swNum}`;
    blockNode = currentTopoNodes.find(n => n.type === 'switch' && n.label === swLabel) || null;
  }
  twinVizInfoList.push({ srcNode, dstNode, blockNode, action: ev.action });
  twinVizPhase = 'idle';
  renderTwinHighlights();
}

function findTopoPath(fromId, toId) {
  const adj = {};
  currentTopoLinks.forEach(({ source, target }) => {
    (adj[source] = adj[source] || []).push(target);
    (adj[target] = adj[target] || []).push(source);
  });
  if (!adj[fromId]) return null;
  const visited = new Set([fromId]);
  const queue   = [[fromId]];
  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === toId) return path;
    for (const nb of (adj[node] || [])) {
      if (!visited.has(nb)) { visited.add(nb); queue.push([...path, nb]); }
    }
  }
  return null;
}

function getTwinLayer() {
  if (!topoSvg) return null;
  let layer = topoSvg.select('.twin-viz');
  if (layer.empty()) layer = topoSvg.append('g').attr('class', 'twin-viz');
  return layer;
}

function renderTwinHighlights() {
  if (!topoSvg) return;
  // Remove previous node-attached indicators
  topoSvg.selectAll('.twin-node-indicator').remove();
  if (!twinVizInfoList.length) return;

  // Collect unique node specs across all sub-rules
  // (compound: multiple src/dst/block entries may exist)
  const seenNodeIds = new Set();
  const specs = [];
  for (const { srcNode, dstNode, blockNode, action } of twinVizInfoList) {
    if (srcNode   && !seenNodeIds.has(srcNode.id))   { seenNodeIds.add(srcNode.id);   specs.push({ node: srcNode,   color: '#10b981', tag: 'SRC',   ip: srcNode.ip }); }
    if (dstNode   && !seenNodeIds.has(dstNode.id))   { seenNodeIds.add(dstNode.id);   specs.push({ node: dstNode,   color: '#60a5fa', tag: 'DST',   ip: dstNode.ip }); }
    if (blockNode && action === 'block' && !seenNodeIds.has(blockNode.id)) { seenNodeIds.add(blockNode.id); specs.push({ node: blockNode, color: '#ef4444', tag: 'BLOCK', ip: null }); }
  }

  specs.forEach(({ node, color, tag, ip }) => {
    const r = node.type === 'switch' ? 22 : 17;

    // Attach directly to the .live-node <g> so it inherits translate(x,y)
    // and follows the node when dragged
    topoSvg.selectAll('g.live-node')
      .filter(d => d.id === node.id)
      .each(function() {
        const g = d3.select(this);

        // Pulsing ring (cx/cy=0 → node center in local coords)
        g.append('circle')
          .attr('class', 'twin-node-indicator twin-ring')
          .attr('r', r).attr('cx', 0).attr('cy', 0)
          .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2.5)
          .attr('pointer-events', 'none');

        // Tag label above node
        g.append('text')
          .attr('class', 'twin-node-indicator')
          .attr('x', 0).attr('y', -r - 6)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9).attr('font-weight', '700')
          .attr('font-family', 'JetBrains Mono, monospace')
          .attr('fill', color).attr('pointer-events', 'none')
          .text(tag);

        // IP address label (one line above the tag)
        if (ip) {
          g.append('text')
            .attr('class', 'twin-node-indicator')
            .attr('x', 0).attr('y', -r - 17)
            .attr('text-anchor', 'middle')
            .attr('font-size', 8)
            .attr('font-family', 'JetBrains Mono, monospace')
            .attr('fill', color).attr('opacity', 0.75).attr('pointer-events', 'none')
            .text(ip);
        }

        // BLOCK: red ✕ overlay on the switch
        if (tag === 'BLOCK') {
          g.append('text')
            .attr('class', 'twin-node-indicator')
            .attr('x', 0).attr('y', 5)
            .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
            .attr('font-size', 13).attr('font-weight', '700')
            .attr('fill', '#ef4444').attr('pointer-events', 'none')
            .text('✕');
        }
      });
  });
}

function spawnPacket(layer, pathIds, color, durationMs, stopIdx) {
  const positions = pathIds.map(id => nodePositions.get(id)).filter(Boolean);
  if (positions.length < 2) return;
  const endIdx = (stopIdx !== undefined) ? Math.min(stopIdx, positions.length - 1) : positions.length - 1;
  const segMs  = durationMs / (positions.length - 1);

  const dot = layer.append('circle')
    .attr('r', 4.5).attr('fill', color).attr('opacity', 0.92)
    .attr('cx', positions[0].x).attr('cy', positions[0].y)
    .attr('pointer-events', 'none');

  let t = dot.transition().duration(0);
  for (let i = 1; i <= endIdx; i++) {
    const p = positions[i];
    t = t.transition().duration(segMs).ease(d3.easeLinear)
         .attr('cx', p.x).attr('cy', p.y);
  }

  if (stopIdx !== undefined && stopIdx < positions.length - 1) {
    // Blocked: burst and vanish
    t.transition().duration(250).attr('r', 9).attr('opacity', 0).remove();
  } else {
    t.transition().duration(300).attr('opacity', 0).remove();
  }
}

function startPacketLoop(path, color, stopIdx) {
  if (!path || path.length < 2) return;
  highlightPath(path, color);
  const totalMs = Math.min(1800, path.length * 450);
  const interval = 650;

  function fire(offset) {
    if (!state.twinActive) return;
    const layer = getTwinLayer();
    if (!layer) return;
    spawnPacket(layer, path, color, totalMs, stopIdx);
    const t = setTimeout(() => fire(interval), interval);
    twinAnimTimers.push(t);
  }

  fire(0);
  // second stream with offset
  const t2 = setTimeout(() => fire(0), interval / 2);
  twinAnimTimers.push(t2);
}

function setTwinPhase(phase) {
  if (twinVizPhase === phase) return;
  twinVizPhase = phase;

  // Clear old animation timers only (keep highlights)
  twinAnimTimers.forEach(t => clearTimeout(t));
  twinAnimTimers = [];
  renderTwinHighlights(); // redraw highlights for new phase

  if (!twinVizInfoList.length || !topoSvg) return;
  // Use all sub-rule specs for animation; first entry drives baseline/regression logic
  const primary = twinVizInfoList[0];
  const { srcNode, dstNode } = primary;

  if (phase === 'baseline') {
    // Green packets: src → dst (no rule yet, full path)
    if (srcNode && dstNode) {
      const path = findTopoPath(srcNode.id, dstNode.id);
      if (path) startPacketLoop(path, '#10b981', undefined);
    }
  } else if (phase === 'deployed') {
    // FlowRule 배포 중 — 블록 스위치만 강조, 패킷 없음
  } else if (phase === 'intent') {
    // Animate each sub-rule's intent
    for (const { srcNode: sn, dstNode: dn, blockNode: bn, action } of twinVizInfoList) {
      if (action === 'block' && sn && bn) {
        const path = findTopoPath(sn.id, bn.id);
        if (path) startPacketLoop(path, '#f87171', path.length - 1);
      } else if (action !== 'block' && sn && dn) {
        const path = findTopoPath(sn.id, dn.id);
        if (path) startPacketLoop(path, '#10b981', undefined);
      }
    }
  } else if (phase === 'regression') {
    // Animate between two hosts that are neither src nor dst of any sub-rule
    const usedIds = new Set(twinVizInfoList.flatMap(v => [v.srcNode?.id, v.dstNode?.id].filter(Boolean)));
    const others  = currentTopoNodes.filter(n => n.type === 'host' && !usedIds.has(n.id));
    if (others.length >= 2) {
      const path = findTopoPath(others[0].id, others[1].id);
      if (path) startPacketLoop(path, '#818cf8', undefined);
    } else if (others.length === 1 && srcNode) {
      const path = findTopoPath(others[0].id, srcNode.id);
      if (path) startPacketLoop(path, '#818cf8', undefined);
    }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  // Build stage cards
  buildStageCards();

  // Intent textarea
  const intentInput = document.getElementById('intent-input');
  intentInput.addEventListener('input', e => {
    state.intent = e.target.value;
    hideIntentTranslation();
  });

  // Run button
  document.getElementById('run-btn').addEventListener('click', runPipeline);

  // Intent presets
  initIntentPresets();

  // Settings
  document.getElementById('model-select').addEventListener('change', e => { state.model = e.target.value; });
  document.getElementById('toggle-rag').addEventListener('change',  e => { state.enableRag = e.target.checked; });
  document.getElementById('toggle-twin').addEventListener('change', e => { state.skipTwin  = e.target.checked; });
  document.getElementById('toggle-deploy').addEventListener('change', e => { state.skipDeploy = e.target.checked; });

  // Layout swap (restore saved state)
  if (localStorage.getItem('layout-swapped') === 'true') {
    document.getElementById('app').classList.add('layout-swapped');
  }
  document.getElementById('layout-swap-btn').addEventListener('click', toggleLayoutSwap);

  // Topology editor controls

  document.getElementById('topo-edit-btn').addEventListener('click', () => {
    if (editor.active) {
      exitEditMode();
    } else {
      enterEditMode().catch(err => console.error('[Editor] enterEditMode failed:', err));
    }
  });
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => setEditorTool(btn.dataset.tool));
  });
  document.getElementById('topo-apply-btn').addEventListener('click', applyTopology);
  document.getElementById('topo-cancel-btn').addEventListener('click', exitEditMode);

  document.getElementById('clear-history-btn').addEventListener('click', async () => {
    if (!confirm('히스토리를 모두 삭제할까요?')) return;
    await fetch('/api/logs', { method: 'DELETE' });
    state.history = [];
    renderHistory();
  });

  // Load history + start topology refresh
  loadHistory();
  startRefreshLoop();

  // Auto-update example chips from saved custom topology on page load
  fetch('/api/topology/custom')
    .then(r => r.ok ? r.json() : null)
    .then(data => { if (data && (data.switches || []).length > 0) updateExampleChips(data); })
    .catch(() => {});

  // Sidebar collapse toggle
  initSidebarToggle();

  // Topology presets
  initTopoPresets();

  // Panel resizer
  initPanelResizer();

  // Default topology panel width: as wide as possible
  const topoPanel = document.getElementById('topology-panel');
  if (topoPanel && !localStorage.getItem('topo-panel-width')) {
    topoPanel.style.width = Math.floor(window.innerWidth * 0.5) + 'px';
  } else if (topoPanel && localStorage.getItem('topo-panel-width')) {
    topoPanel.style.width = localStorage.getItem('topo-panel-width');
  }

  // Topo info sections: start collapsed
  document.querySelectorAll('.topo-info-section').forEach(section => {
    const body = section.querySelector('.topo-info-body');
    if (!body) return;
    section.classList.add('collapsed');
    body.style.maxHeight = '0';
  });
}

// ── Panel Resizer ─────────────────────────────────────────────────────────────

function initPanelResizer() {
  const resizer = document.getElementById('panel-resizer');
  const panel   = document.getElementById('topology-panel');
  if (!resizer || !panel) return;

  let startX, startWidth;

  resizer.addEventListener('mousedown', e => {
    startX     = e.clientX;
    startWidth = panel.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor     = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    e.preventDefault();
  });

  function onMouseMove(e) {
    const swapped  = document.getElementById('app').classList.contains('layout-swapped');
    // Normal: topology is on the right → drag left (startX > clientX) expands panel
    // Swapped: topology is on the left → drag right (clientX > startX) expands panel
    const delta    = swapped ? e.clientX - startX : startX - e.clientX;
    const minWidth = 220;
    const maxWidth = Math.floor(window.innerWidth * 0.6);
    const newWidth = Math.min(Math.max(startWidth + delta, minWidth), maxWidth);
    panel.style.width = newWidth + 'px';
    syncTopoSize();
  }

  function onMouseUp() {
    resizer.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor     = '';
    localStorage.setItem('topo-panel-width', panel.style.width);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
  }
}

// ── Topology Size Sync ────────────────────────────────────────────────────────

function syncTopoSize() {
  if (!topoSvg) return;
  const container = document.getElementById('topology-graph');
  const w = container.clientWidth  || 342;
  const h = container.clientHeight || 280;
  topoSvg.attr('viewBox', `0 0 ${w} ${h}`);
  if (editor.active) {
    renderEditorGraph();
  } else if (simulation) {
    simulation.force('center', d3.forceCenter(w / 2, h / 2));
    simulation.alpha(0.3).restart();
  }
}

// ── Collapsible Info Sections ─────────────────────────────────────────────────

function toggleInfoSection(id) {
  const section = document.getElementById(id);
  if (!section) return;
  const body      = section.querySelector('.topo-info-body');
  const collapsed = section.classList.toggle('collapsed');
  body.style.maxHeight = collapsed ? '0' : body.scrollHeight + 'px';
  setTimeout(syncTopoSize, 260);
}

function initIntentPresets() {
  const btn  = document.getElementById('intent-preset-btn');
  const menu = document.getElementById('intent-preset-menu');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = menu.classList.contains('open');
    if (!isOpen) {
      menu.style.visibility = 'hidden';
      menu.style.display = 'block';
      const menuH = menu.offsetHeight;
      menu.style.display = '';
      menu.style.visibility = '';

      const r = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - 8;
      if (spaceBelow >= menuH || spaceBelow >= 200) {
        menu.style.top    = (r.bottom + 5) + 'px';
        menu.style.bottom = '';
      } else {
        menu.style.top    = '';
        menu.style.bottom = (window.innerHeight - r.top + 5) + 'px';
      }
      menu.style.left = r.left + 'px';
    }
    menu.classList.toggle('open');
  });

  document.addEventListener('click', () => menu.classList.remove('open'));

  menu.querySelectorAll('.preset-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.remove('open');
      fillIntent(item.dataset.intent, item.dataset.kr);
    });
  });
}

function toggleTopoPanel() {
  const panel = document.getElementById('topology-panel');
  const collapsed = panel.classList.toggle('topo-collapsed');
  // After transition, sync resizer behaviour
  setTimeout(syncTopoSize, 310);
  // Shrink panel width when collapsed so main gets the space
  if (collapsed) {
    panel._savedWidth = panel.style.width;
    panel.style.width = '';
  } else {
    if (panel._savedWidth) panel.style.width = panel._savedWidth;
    setTimeout(syncTopoSize, 310);
  }
}

// ── Sidebar Toggle ────────────────────────────────────────────────────────────

function initSidebarToggle() {
  const btn     = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.getElementById('sidebar');
  const stored  = localStorage.getItem('sidebar-collapsed') === 'true';

  if (stored) {
    sidebar.classList.add('collapsed');
    btn.textContent = '▶';
    btn.title = '사이드바 펼치기';
  }

  btn.addEventListener('click', () => {
    const collapsed = sidebar.classList.toggle('collapsed');
    btn.textContent = collapsed ? '▶' : '◀';
    btn.title       = collapsed ? '사이드바 펼치기' : '사이드바 접기';
    localStorage.setItem('sidebar-collapsed', collapsed);
  });
}

// ── Topology Presets ──────────────────────────────────────────────────────────

function initTopoPresets() {
  const btn  = document.getElementById('topo-preset-btn');
  const menu = document.getElementById('topo-preset-menu');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = menu.classList.contains('open');
    if (!isOpen) {
      // Temporarily show to measure height
      menu.style.visibility = 'hidden';
      menu.style.display = 'block';
      const menuH = menu.offsetHeight;
      menu.style.display = '';
      menu.style.visibility = '';

      const r = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - 8;
      if (spaceBelow >= menuH || spaceBelow >= 200) {
        menu.style.top    = (r.bottom + 5) + 'px';
        menu.style.bottom = '';
      } else {
        menu.style.top    = '';
        menu.style.bottom = (window.innerHeight - r.top + 5) + 'px';
      }
      menu.style.right = (window.innerWidth - r.right) + 'px';
    }
    menu.classList.toggle('open');
  });

  document.addEventListener('click', () => menu.classList.remove('open'));

  menu.querySelectorAll('.preset-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.remove('open');
      applyPreset(item.dataset.preset);
    });
  });
}

async function applyPreset(presetName) {
  const preset = TOPOLOGY_PRESETS[presetName];
  if (!preset) return;

  const payload = {
    switches: preset.switches,
    hosts:    preset.hosts,
    links:    preset.links,
  };

  const btn = document.getElementById('topo-preset-btn');
  const orig = btn.textContent;
  btn.textContent = '저장 중…';
  btn.disabled = true;

  try {
    // 1. Save to custom topology file
    await fetch('/api/topology/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 2. Push to ONOS (best-effort)
    try {
      await fetch('/api/topology/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (_) {}

    // 3. Update intent chips and title flash
    updateExampleChips(payload);

    const titleEl = document.getElementById('topo-title');
    if (titleEl) {
      const prev = titleEl.textContent;
      titleEl.textContent = `${preset.label} 프리셋 적용됨`;
      setTimeout(() => { titleEl.textContent = prev; }, 3000);
    }

    // 4. Trigger immediate topology display refresh
    fetchTopology();

  } catch (err) {
    console.error('[Preset] apply failed:', err);
  }

  btn.textContent = orig;
  btn.disabled = false;
}

function toggleLayoutSwap() {
  const app     = document.getElementById('app');
  const swapped = app.classList.toggle('layout-swapped');
  localStorage.setItem('layout-swapped', swapped);
  const btn = document.getElementById('layout-swap-btn');
  if (btn) btn.title = swapped ? '원래 배치로 전환' : '좌우 배치 전환';
}


// ── Editor: undo stack ─────────────────────────────────────────────────────────

const editorHistory = [];

function editorPushHistory() {
  editorHistory.push({
    nodes: JSON.parse(JSON.stringify(editor.nodes)),
    links: JSON.parse(JSON.stringify(editor.links)),
  });
  if (editorHistory.length > 30) editorHistory.shift();
}

function editorUndo() {
  if (!editorHistory.length) return;
  const snap = editorHistory.pop();
  editor.nodes = snap.nodes;
  editor.links = snap.links;
  editor.selected = null;
  renderEditorGraph();
  renderPropsPanel();
}

// ── Editor: lasso (Shift+drag) ─────────────────────────────────────────────────

const lasso = { active: false, x0: 0, y0: 0, x1: 0, y1: 0 };

function updateLassoRect() {
  if (!topoSvg) return;
  const x = Math.min(lasso.x0, lasso.x1);
  const y = Math.min(lasso.y0, lasso.y1);
  const w = Math.abs(lasso.x1 - lasso.x0);
  const h = Math.abs(lasso.y1 - lasso.y0);
  topoSvg.select('#lasso-rect')
    .attr('x', x).attr('y', y).attr('width', w).attr('height', h)
    .attr('opacity', 1);
}

function commitLasso() {
  const x0 = Math.min(lasso.x0, lasso.x1);
  const x1 = Math.max(lasso.x0, lasso.x1);
  const y0 = Math.min(lasso.y0, lasso.y1);
  const y1 = Math.max(lasso.y0, lasso.y1);
  if (x1 - x0 < 5 && y1 - y0 < 5) return; // too small — treat as click, ignore
  const inside = editor.nodes.filter(n => n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1);
  if (inside.length === 0) return;
  editorPushHistory();
  const ids = new Set(inside.map(n => n.id));
  editor.nodes = editor.nodes.filter(n => !ids.has(n.id));
  editor.links = editor.links.filter(l => !ids.has(l.source) && !ids.has(l.target));
  if (ids.has(editor.selected)) editor.selected = null;
  renderEditorGraph();
  renderPropsPanel();
}

function isEditorBg(ev) {
  // True if the click target is SVG background (not an ed-node or ed-link group)
  let el = ev.target;
  while (el && el !== topoSvg?.node()) {
    if (el.classList?.contains('ed-node') || el.classList?.contains('ed-link')) return false;
    el = el.parentElement;
  }
  return true;
}

// ── Keyboard shortcuts ──────────────────────────────────────────────────────────

document.addEventListener('keydown', ev => {
  const inInput = ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA';

  if (!editor.active || inInput) return;

  switch (ev.key) {
    case 's': setEditorTool('switch'); break;
    case 'h': setEditorTool('host');   break;
    case 'l': setEditorTool('link');   break;
    case 'd': setEditorTool('delete'); break;
    case 'Escape':
      if (editor.linking) {
        editor.linking = null;
        topoSvg?.select('#ghost-link').attr('opacity', 0);
        renderEditorGraph();
      } else {
        setEditorTool('select');
      }
      break;
    case 'Backspace':
    case 'Delete':
      if (editor.selected) {
        editorPushHistory();
        editor.nodes = editor.nodes.filter(n => n.id !== editor.selected);
        editor.links = editor.links.filter(l =>
          l.source !== editor.selected && l.target !== editor.selected
        );
        editor.selected = null;
        renderEditorGraph();
        renderPropsPanel();
        ev.preventDefault();
      }
      break;
    case 'z':
      if (ev.ctrlKey || ev.metaKey) { editorUndo(); ev.preventDefault(); }
      break;
  }
});

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', syncTopoSize);
