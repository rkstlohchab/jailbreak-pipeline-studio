"use client";
import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, RoundedBox, Billboard, Grid, Bounds, useBounds } from "@react-three/drei";
import * as THREE from "three";
import type { ModelFamily, Ask } from "@/lib/api";
import { SceneCanvas, StudioLights, useSceneMotion } from "./SceneCanvas";
import { threeHSL } from "@/lib/theme";

import { expectedFor, type Expected } from "@/lib/model-matrix";

const EXPECTED_HSL: Record<Expected, string> = {
  high: "210 55% 73%",
  mid:  "38 38% 64%",
  low:  "8 32% 56%",
};

const COL = 1.3; // x-step per ask
const ROW = 0.95; // z-step per model

function Cell({ x, z, expected, selected, onPick }: {
  x: number; z: number; expected: Expected; selected: boolean;
  onPick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const moving = useSceneMotion();
  const height = expected === "high" ? 1.9 : expected === "mid" ? 1.0 : 0.3;
  const base = useMemo(() => new THREE.Color(threeHSL(EXPECTED_HSL[expected])), [expected]);

  useFrame((state) => {
    if (!ref.current) return;
    if (!moving) { ref.current.scale.y = 1; return; }
    const t = state.clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = selected ? 0.4 + Math.sin(t * 2) * 0.06 : 0.08;
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
        emissiveIntensity={selected ? 0.4 : 0.08}
        metalness={0.55}
        roughness={0.3}
      />
    </RoundedBox>
  );
}

function MatrixFraming({ columns, rows }: { columns: number; rows: number }) {
  const bounds = useBounds();
  const { width, height } = useThree((state) => state.size);
  useEffect(() => {
    // Reserve label space before asynchronous font geometry finishes synchronizing.
    const halfWidth = Math.max(1, (columns - 1) * COL / 2);
    const halfDepth = Math.max(1, (rows - 1) * ROW / 2);
    bounds.refresh(new THREE.Box3(new THREE.Vector3(-halfWidth - 8, -0.3, -halfDepth - 2), new THREE.Vector3(halfWidth + 1, 3, halfDepth + 1))).clip().fit();
  }, [bounds, columns, rows, width, height]);
  return null;
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
    <SceneCanvas label="Model matrix: models by ask class. Bar heights show heuristic expectations, not measured results. Click a bar to inspect." orthographic animate={false} camera={{ position: [cx + 7, cy + 5, cz + 6], zoom: 38 }}>
      <color attach="background" args={["#111923"]} />
      <StudioLights />
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

      <Bounds fit clip observe margin={1.25} maxDuration={0}>
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
          <Text font="/fonts/manrope-regular.ttf"
            fontSize={0.22}
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
        <Billboard key={a.ask_id} position={[ai * COL + xMin, 2.6, zMin - 0.9]}>
          <Text font="/fonts/manrope-regular.ttf"
            fontSize={0.2}
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
          <Text font="/fonts/manrope-regular.ttf"
            position={[0, -0.4, 0]}
            fontSize={0.13}
            anchorX="center"
            anchorY="middle"
            color="#a9bdd8"
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

      <MatrixFraming columns={asks.length} rows={families.length} />
      </Bounds>
      <OrbitControls makeDefault
        enablePan
        minDistance={6}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0.5, 0]}
      />
    </SceneCanvas>
  );
}
