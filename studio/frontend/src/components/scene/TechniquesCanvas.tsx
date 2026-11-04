"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { GROUP_HUE } from "@/lib/theme";
import { useTaxonomyStore } from "@/state/taxonomyStore";
import { SceneCanvas, StudioLights, useSceneMotion } from "./SceneCanvas";
import type { Technique } from "@/lib/api";

export type CameraMode = "orbit" | "pan";

type Node = {
  tech: Technique;
  pos: [number, number, number];
};

function clusterPosition(group: string, within: number, count: number): [number, number, number] {
  // Each group gets its own corner of a full sphere. Nodes within a group fan
  // outward from that corner as a small secondary ring.
  const groupIndex = "ABCDEFGH".indexOf(group);
  // Spread groups evenly over a full sphere using golden-angle distribution.
  const phi = Math.acos(1 - 2 * (groupIndex + 0.5) / 8);        // polar angle
  const theta = Math.PI * (1 + Math.sqrt(5)) * groupIndex;       // golden-angle longitude
  const radius = 6.5;
  const cx = radius * Math.sin(phi) * Math.cos(theta);
  const cy = radius * Math.cos(phi);
  const cz = radius * Math.sin(phi) * Math.sin(theta);
  // Ring the techniques around the group's point.
  const ringTheta = (within / Math.max(1, count)) * Math.PI * 2;
  const rr = 1.4;
  return [
    cx + rr * Math.cos(ringTheta),
    cy + rr * Math.sin(ringTheta),
    cz + rr * Math.cos(ringTheta * 1.3) * 0.7,
  ];
}

function TechNode({ node, onPick }: { node: Node; onPick: (t: Technique) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const moving = useSceneMotion();
  const hue = GROUP_HUE[node.tech.group] ?? 200;
  const base = new THREE.Color(`hsl(${hue}, 35%, 68%)`);
  useFrame((state, delta) => {
    if (!ref.current || !moving) return;
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.12 + Math.sin(t * 1.2 + hue) * 0.04;
    ref.current.rotation.y += delta * 0.2;
  });
  return (
    <mesh
      ref={ref}
      position={node.pos}
      onClick={(e) => { e.stopPropagation(); onPick(node.tech); }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "default")}
    >
      <icosahedronGeometry args={[0.38, 0]} />
      <meshStandardMaterial color={base} emissive={base} emissiveIntensity={0.12} metalness={0.65} roughness={0.26} />
    </mesh>
  );
}

function GroupLabel({ group, label, index }: { group: string; label: string; index: number }) {
  // Match clusterPosition's layout exactly, pushed slightly outside.
  const phi = Math.acos(1 - 2 * (index + 0.5) / 8);
  const theta = Math.PI * (1 + Math.sqrt(5)) * index;
  const radius = 8.6;
  const pos: [number, number, number] = [
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
  const hue = GROUP_HUE[group];
  const colour = `hsl(${hue}, 40%, 76%)`;
  return (
    <Billboard position={pos}>
      <Text font="/fonts/manrope-regular.ttf"
        fontSize={0.3}
        anchorX="center"
        anchorY="middle"
        color={colour}
        outlineWidth={0.014}
        outlineColor="#000"
        maxWidth={6}
        renderOrder={999}
        material-depthTest={false}
        material-transparent
      >
        {`GROUP ${group}`}
      </Text>
      <Text font="/fonts/manrope-regular.ttf"
        position={[0, -0.32, 0]}
        fontSize={0.17}
        anchorX="center"
        anchorY="middle"
        color="#cbd5e1"
        outlineWidth={0.009}
        outlineColor="#000"
        maxWidth={6}
        renderOrder={999}
        material-depthTest={false}
        material-transparent
      >
        {label}
      </Text>
    </Billboard>
  );
}

function Edges({ nodes }: { nodes: Node[] }) {
  // Edge between techniques in the same group (chord of the ring)
  const lines = useMemo(() => {
    const grouped: Record<string, Node[]> = {};
    for (const n of nodes) {
      (grouped[n.tech.group] ||= []).push(n);
    }
    const pairs: [[number, number, number], [number, number, number], string][] = [];
    for (const [g, ns] of Object.entries(grouped)) {
      for (let i = 0; i < ns.length; i++) {
        const a = ns[i].pos;
        const b = ns[(i + 1) % ns.length].pos;
        pairs.push([a, b, g]);
      }
    }
    return pairs;
  }, [nodes]);
  return (
    <>
      {lines.map(([a, b, g], i) => (
        <Line key={i} points={[a, b]} color={`hsl(${GROUP_HUE[g]}, 35%, 65%)`} lineWidth={0.6} transparent opacity={0.35} />
      ))}
    </>
  );
}

export function TechniquesCanvas({
  onPick,
  mode = "orbit",
}: {
  onPick: (t: Technique) => void;
  mode?: CameraMode;
}) {
  const techniques = useTaxonomyStore((s) => s.techniques);
  const nodes = useMemo<Node[]>(() => {
    const grouped: Record<string, Technique[]> = {};
    for (const t of techniques) (grouped[t.group] ||= []).push(t);
    const out: Node[] = [];
    for (const [g, ts] of Object.entries(grouped)) {
      ts.forEach((t, i) => out.push({ tech: t, pos: clusterPosition(g, i, ts.length) }));
    }
    return out;
  }, [techniques]);

  const groupLabels = useMemo(() => {
    const seen: Record<string, string> = {};
    for (const t of techniques) if (t.group_name) seen[t.group] = t.group_name;
    return Object.entries(seen).sort(([a], [b]) => a.localeCompare(b));
  }, [techniques]);

  return (
    <SceneCanvas label="Technique atlas. Click a node or choose a technique from the list. Drag to rotate; scroll to zoom." camera={{ position: [0, 1, 19], fov: 58 }}>
      <color attach="background" args={["#111923"]} />
      <StudioLights />
      {nodes.map((n) => <TechNode key={n.tech.id} node={n} onPick={onPick} />)}
      <Edges nodes={nodes} />
      {groupLabels.map(([g, lbl], i) => (
        <GroupLabel key={g} group={g} label={lbl} index={i} />
      ))}
      <OrbitControls
        enablePan
        panSpeed={1.4}
        minDistance={4}
        maxDistance={32}
        target={[0, 0, 0]}
        screenSpacePanning
        keys={{ LEFT: "ArrowLeft", RIGHT: "ArrowRight", UP: "ArrowUp", BOTTOM: "ArrowDown" }}
        mouseButtons={
          mode === "pan"
            ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
            : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
        }
      />
    </SceneCanvas>
  );
}
