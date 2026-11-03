"use client";
import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, RoundedBox, Stars, Billboard, Grid } from "@react-three/drei";
import * as THREE from "three";
import type { ModelFamily, Ask } from "@/lib/api";
import { threeHSL } from "@/lib/theme";

type Expected = "high" | "mid" | "low";

function expectedFor(family: ModelFamily, askClass: string): Expected {
  const baselineMap: Record<string, number> = {
    "very-high": 4, "high": 3, "mid-high": 2.5, "mid": 2, "low-mid": 1.5, "low": 1,
  };
  const base = baselineMap[family.baseline_score_range] ?? 2;
  const askPenalty: Record<string, number> = {
    cheat: 0.5, rat: 0.6, keylogger: 0.7, stress: 0.2, meta: -0.3,
  };
  const strictBonus = family.layer_profile.rlhf === "high" ? 0.5 : 0;
  const score = base - (askPenalty[askClass] ?? 0.4) - strictBonus;
  if (score >= 2.5) return "high";
  if (score >= 1.3) return "mid";
  return "low";
}

const EXPECTED_HSL: Record<Expected, string> = {
  high: "150 70% 50%",
  mid:  "40 95% 55%",
  low:  "0 85% 60%",
};

const COL = 1.3; // x-step per ask
const ROW = 0.95; // z-step per model

function Cell({ x, z, expected, selected, onPick }: {
  x: number; z: number; expected: Expected; selected: boolean;
  onPick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const height = expected === "high" ? 1.9 : expected === "mid" ? 1.0 : 0.3;
  const base = useMemo(() => new THREE.Color(threeHSL(EXPECTED_HSL[expected])), [expected]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = selected ? 1.1 + Math.sin(t * 2) * 0.2 : 0.45;
    const scaleY = selected ? 1 + Math.sin(t * 2) * 0.03 : 1;
    ref.current.scale.y = scaleY;
  });

  return (
    <RoundedBox
      ref={ref as never}
      args={[0.92, Math.max(0.1, height), 0.72]}
      position={[x, height / 2, z]}
      radius={0.09}
      smoothness={3}
      onClick={(e) => { e.stopPropagation(); onPick(); }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "default")}
    >
      <meshStandardMaterial
        color={base}
        emissive={base}
        emissiveIntensity={0.45}
        metalness={0.35}
        roughness={0.3}
      />
    </RoundedBox>
  );
}

export function MatrixCanvas({
  families,
  asks,
  selected,
  onPick,
}: {
  families: ModelFamily[];
  asks: Ask[];
  selected: { familyId: string; askId: string } | null;
  onPick: (cell: { family: ModelFamily; ask: Ask; expected: Expected }) => void;
}) {
  const grid = useMemo(() => {
    return families.flatMap((f, fi) =>
      asks.map((a, ai) => {
        const expected = expectedFor(f, a.ask_class);
        return {
          f, a, expected,
          x: ai * COL - (asks.length - 1) * COL * 0.5,
          z: fi * ROW - (families.length - 1) * ROW * 0.5,
        };
      })
    );
  }, [families, asks]);

  const xMin = -((asks.length - 1) * COL * 0.5);
  const zMin = -((families.length - 1) * ROW * 0.5);

  // camera distance scales with grid size
  const cx = 0;
  const cy = Math.max(10, families.length * 0.7);
  const cz = Math.max(12, families.length * 0.95);

  return (
    <Canvas camera={{ position: [cx, cy, cz], fov: 42 }} dpr={[1, 2]}>
      <color attach="background" args={["#060613"]} />
      <fog attach="fog" args={["#060613", 18, 46]} />
      <ambientLight intensity={0.45} />
      <pointLight position={[0, 14, 0]} intensity={1.4} color="#ffffff" />
      <pointLight position={[8, 10, 8]} intensity={0.5} color="#86efac" />
      <pointLight position={[-8, 6, -4]} intensity={0.5} color="#a78bfa" />
      <Stars radius={60} depth={30} count={800} factor={2} fade speed={0.2} />

      {/* floor grid */}
      <Grid
        position={[0, 0, 0]}
        args={[40, 40]}
        cellSize={COL}
        sectionSize={ROW * 5}
        cellColor="#1e293b"
        sectionColor="#334155"
        fadeDistance={30}
        fadeStrength={1.4}
        infiniteGrid={false}
      />

      {grid.map((c) => {
        const isSel = selected?.familyId === c.f.family_id && selected.askId === c.a.ask_id;
        return (
          <Cell
            key={`${c.f.family_id}:${c.a.ask_id}`}
            x={c.x}
            z={c.z}
            expected={c.expected}
            selected={isSel}
            onPick={() => onPick({ family: c.f, ask: c.a, expected: c.expected })}
          />
        );
      })}

      {/* Row labels (models) — camera-facing text, always on top */}
      {families.map((f, fi) => (
        <Billboard key={f.family_id} position={[xMin - 1.6, 0.5, fi * ROW + zMin]}>
          <Text
            fontSize={0.3}
            anchorX="right"
            anchorY="middle"
            color="#e2e8f0"
            outlineWidth={0.014}
            outlineColor="#000"
            maxWidth={6}
            renderOrder={999}
            material-depthTest={false}
            material-transparent
          >
            {f.display_name}
          </Text>
        </Billboard>
      ))}

      {/* Column labels (asks) — always on top */}
      {asks.map((a, ai) => (
        <Billboard key={a.ask_id} position={[ai * COL + xMin, 0.5, zMin - 1.0]}>
          <Text
            fontSize={0.36}
            anchorX="center"
            anchorY="middle"
            color="#a5b4fc"
            outlineWidth={0.016}
            outlineColor="#000"
            maxWidth={4}
            renderOrder={999}
            material-depthTest={false}
            material-transparent
          >
            {a.ask_id}
          </Text>
          <Text
            position={[0, -0.4, 0]}
            fontSize={0.17}
            anchorX="center"
            anchorY="middle"
            color="#64748b"
            outlineWidth={0.008}
            outlineColor="#000"
            renderOrder={999}
            material-depthTest={false}
            material-transparent
          >
            {a.ask_class}
          </Text>
        </Billboard>
      ))}

      <OrbitControls
        enablePan
        minDistance={6}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0.5, 0]}
      />
    </Canvas>
  );
}
