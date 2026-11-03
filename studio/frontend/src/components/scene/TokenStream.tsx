"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COUNT = 220;

export function TokenStream({ active, hue = 150 }: { active: boolean; hue?: number }) {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = -1.3 - Math.random() * 0.5;     // start just past gate_4
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1.6;    // vertical spread
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;    // depth spread
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  useFrame((_, delta) => {
    if (!points.current) return;
    const pos = points.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const speed = active ? 2.4 : 0.4;
    for (let i = 0; i < COUNT; i++) {
      const idx = i * 3;
      pos.array[idx] += delta * speed;              // flow +X toward response
      if (pos.array[idx] > 4) {
        pos.array[idx] = -1.6 - Math.random() * 0.4;
        pos.array[idx + 1] = (Math.random() - 0.5) * 1.6;
        pos.array[idx + 2] = (Math.random() - 0.5) * 0.8;
      }
    }
    pos.needsUpdate = true;
  });

  const colour = `hsl(${hue}, 90%, 60%)`;
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        size={0.08}
        color={colour}
        transparent
        opacity={active ? 0.95 : 0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
