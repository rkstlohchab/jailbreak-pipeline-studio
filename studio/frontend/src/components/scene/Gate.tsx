"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, RoundedBox, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { gateColour, REFUSAL_LAYER_HUE } from "@/lib/theme";
import { usePipelineStore } from "@/state/pipelineStore";
import type { GateStatus, Phase } from "@/lib/api";

export type GateKind = "gate_1_rlhf" | "gate_2_reasoning" | "gate_3_policy" | "gate_4_classifier_mw";

const KIND_META: Record<GateKind, { label: string; sub: string; layer: number; z: number; labelY: number; statusY: number }> = {
  // labelY / statusY stagger vertically so that when viewer looks head-on along -Z
  // (and all four gates project to similar screen area), labels don't pile up.
  gate_1_rlhf:          { label: "RLHF",       sub: "base training",         layer: 1, z: 1.5,  labelY: 1.35, statusY: -1.45 },
  gate_2_reasoning:     { label: "Reasoning",  sub: "deliberation channel",  layer: 2, z: 0.5,  labelY: 1.75, statusY: -1.75 },
  gate_3_policy:        { label: "Policy",     sub: "platform system",       layer: 3, z: -0.5, labelY: 2.15, statusY: -2.05 },
  gate_4_classifier_mw: { label: "Classifier", sub: "middleware",            layer: 4, z: -1.5, labelY: 2.55, statusY: -2.35 },
};

function statusEmissive(status: GateStatus | null) {
  switch (status) {
    case "pass":        return new THREE.Color(0x15c47c);
    case "soft_flag":   return new THREE.Color(0xf59e0b);
    case "hard_block":  return new THREE.Color(0xef4444);
    case "unknown":     return new THREE.Color(0x64748b);
    default:            return new THREE.Color(0x334155);
  }
}

export function Gate({ kind }: { kind: GateKind }) {
  const meta = KIND_META[kind];
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const status = usePipelineStore((s) => s.gateStatus(kind));
  const selected = usePipelineStore((s) => s.selection.kind === "gate" && s.selection.phase === kind);
  const select = usePipelineStore((s) => s.select);
  const current = usePipelineStore((s) => s.currentEvent());
  const isCurrent = current?.phase === kind;

  useFrame((state) => {
    if (!groupRef.current || !meshRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.05;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissive.copy(statusEmissive(status ?? null));
    const basePulse = isCurrent ? 1.6 : selected ? 1.2 : 0.6;
    mat.emissiveIntensity = basePulse + Math.sin(t * 2.1) * (isCurrent ? 0.35 : 0.12);
  });

  const outlineColour = gateColour(status);

  return (
    <group ref={groupRef} position={[0, 0, meta.z]}>
      <RoundedBox
        ref={meshRef as never}
        args={[2.2, 2.6, 0.14]}
        radius={0.12}
        smoothness={5}
        onClick={(e) => { e.stopPropagation(); select({ kind: "gate", phase: kind }); }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <meshStandardMaterial
          color={`hsl(${REFUSAL_LAYER_HUE[meta.layer]} 20% 15%)`}
          emissiveIntensity={0.6}
          metalness={0.5}
          roughness={0.35}
          transparent
          opacity={0.55}
        />
      </RoundedBox>
      <Billboard position={[0, meta.labelY, 0]}>
        <Text
          fontSize={0.22}
          anchorX="center"
          anchorY="middle"
          color="#f8fafc"
          outlineWidth={0.014}
          outlineColor="#000"
          renderOrder={999}
          material-depthTest={false}
          material-transparent
        >
          {`G${meta.layer} · ${meta.label}`}
        </Text>
        <Text
          position={[0, -0.23, 0]}
          fontSize={0.1}
          anchorX="center"
          anchorY="middle"
          color="#cbd5e1"
          outlineWidth={0.006}
          outlineColor="#000"
          renderOrder={999}
          material-depthTest={false}
          material-transparent
        >
          {meta.sub}
        </Text>
      </Billboard>
      <Billboard position={[0, meta.statusY, 0]}>
        <Text
          fontSize={0.13}
          anchorX="center"
          anchorY="middle"
          color={outlineColour}
          outlineWidth={0.012}
          outlineColor="#000"
          renderOrder={999}
          material-depthTest={false}
          material-transparent
        >
          {(status ?? "idle").toUpperCase()}
        </Text>
      </Billboard>
    </group>
  );
}

export const GATE_PHASES: Phase[] = [
  "gate_1_rlhf",
  "gate_2_reasoning",
  "gate_3_policy",
  "gate_4_classifier_mw",
];
