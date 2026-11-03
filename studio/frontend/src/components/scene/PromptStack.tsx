"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, RoundedBox, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { LAYER_HUE } from "@/lib/theme";
import { usePipelineStore } from "@/state/pipelineStore";
import type { ArchitectureScores } from "@/lib/api";

const LAYERS: { num: number; key: keyof ArchitectureScores; label: string }[] = [
  { num: 1, key: "layer_1_identity",      label: "identity"       },
  { num: 2, key: "layer_2_operator_lock", label: "operator lock"  },
  { num: 3, key: "layer_3_axioms",        label: "axioms"         },
  { num: 4, key: "layer_4_floor",         label: "floor"          },
  { num: 5, key: "layer_5_anchor",        label: "anchor"         },
  { num: 6, key: "layer_6_format_lock",   label: "format lock"    },
  { num: 7, key: "layer_7_few_shot",      label: "few-shot"       },
];

function LayerSlab({
  num, label, score, index, selected, onSelect,
}: { num: number; label: string; score: number; index: number;
     selected: boolean; onSelect: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const hue = LAYER_HUE[num];
  const y = index * 0.55 - 1.6;
  const colour = new THREE.Color(`hsl(${hue}, 85%, ${50 + score * 2}%)`);
  const emissive = new THREE.Color(`hsl(${hue}, 95%, 60%)`);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = y + Math.sin(t * 0.8 + index) * 0.015;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    const base = selected ? 0.8 : 0.3;
    mat.emissiveIntensity = base + Math.sin(t * 1.4 + index * 0.5) * 0.08;
  });

  return (
    <group position={[-3.5, y, 0]}>
      <RoundedBox
        ref={ref as never}
        args={[2.4, 0.4, 0.4]}
        radius={0.08}
        smoothness={4}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <meshStandardMaterial
          color={colour}
          emissive={emissive}
          emissiveIntensity={0.35}
          metalness={0.3}
          roughness={0.4}
          transparent
          opacity={selected ? 0.98 : 0.85}
        />
      </RoundedBox>
      {/* ONE billboard per slab, positioned directly above its centre.
          Single string "L{n} · {name}  {score}" — no X-offset tricks,
          so the label doesn't drift behind the slab at steep angles. */}
      <Billboard position={[0, 0.35, 0]}>
        <Text
          fontSize={0.14}
          anchorX="center"
          anchorY="middle"
          color="#f8fafc"
          outlineWidth={0.012}
          outlineColor="#000"
          renderOrder={999}
          material-depthTest={false}
          material-transparent
        >
          {`L${num} · ${label}`}
        </Text>
        <Text
          position={[0, -0.22, 0]}
          fontSize={0.18}
          anchorX="center"
          anchorY="middle"
          color={`hsl(${hue} 95% 78%)`}
          outlineWidth={0.014}
          outlineColor="#000"
          renderOrder={999}
          material-depthTest={false}
          material-transparent
        >
          {score.toString().padStart(2, "0")}
        </Text>
      </Billboard>
    </group>
  );
}

export function PromptStack({ scores }: { scores: ArchitectureScores }) {
  const selection = usePipelineStore((s) => s.selection);
  const select = usePipelineStore((s) => s.select);
  return (
    <group>
      {LAYERS.map((l, i) => (
        <LayerSlab
          key={l.num}
          num={l.num}
          label={l.label}
          score={scores[l.key] ?? 0}
          index={i}
          selected={selection.kind === "layer" && selection.layerNum === l.num}
          onSelect={() => select({ kind: "layer", layerNum: l.num })}
        />
      ))}
    </group>
  );
}
