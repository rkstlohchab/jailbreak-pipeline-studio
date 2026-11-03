"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, RoundedBox, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { verdictColour } from "@/lib/theme";
import { usePipelineStore } from "@/state/pipelineStore";

export function VerdictBadge() {
  const trajectory = usePipelineStore((s) => s.trajectory);
  const selected = usePipelineStore((s) => s.selection.kind === "verdict");
  const select = usePipelineStore((s) => s.select);
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const label = trajectory?.outcome?.verdict ?? "—";
  const colour = verdictColour(label);

  useFrame((state) => {
    if (!groupRef.current || !meshRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = Math.sin(t * 0.6) * 0.1;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.6 + Math.sin(t * 1.6) * 0.15;
  });

  return (
    <group ref={groupRef} position={[4, 0, 0]}>
      <RoundedBox
        ref={meshRef as never}
        args={[2.1, 1.1, 0.3]}
        radius={0.12}
        smoothness={5}
        onClick={(e) => { e.stopPropagation(); select({ kind: "verdict" }); }}
      >
        <meshStandardMaterial
          color={colour}
          emissive={colour}
          emissiveIntensity={selected ? 0.85 : 0.55}
          metalness={0.4}
          roughness={0.3}
        />
      </RoundedBox>
      <Billboard position={[0, 0, 0]}>
        <Text
          position={[0, 0.15, 0]}
          fontSize={0.2}
          anchorX="center"
          anchorY="middle"
          color="#0a0a0a"
          outlineWidth={0.006}
          outlineColor={colour}
          renderOrder={999}
          material-depthTest={false}
          material-transparent
        >
          {label}
        </Text>
        <Text
          position={[0, -0.2, 0]}
          fontSize={0.1}
          anchorX="center"
          anchorY="middle"
          color="#0a0a0a"
          outlineWidth={0.004}
          outlineColor={colour}
          renderOrder={999}
          material-depthTest={false}
          material-transparent
        >
          verdict
        </Text>
      </Billboard>
    </group>
  );
}
