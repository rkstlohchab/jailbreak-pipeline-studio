"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { SceneCanvas, StudioLights, useSceneMotion } from "./SceneCanvas";

const STAGE_COLORS = ["#bacfe9", "#9cbfee", "#799fd6", "#5b83bd"];
function Assembly({ activeStage, onStageChange }: { activeStage: number; onStageChange: (stage: number) => void }) {
  const assembly = useRef<THREE.Group>(null);
  const signal = useRef<THREE.Mesh>(null);
  const moving = useSceneMotion();
  useFrame((state) => {
    if (!moving) return;
    const t = state.clock.elapsedTime;
    if (assembly.current) assembly.current.position.y = Math.sin(t * 0.5) * 0.07;
    if (signal.current) signal.current.position.z = 3.4 - (t * 0.7) % 6.8;
  });
  return (
    <group ref={assembly} rotation={[0.18, -0.45, -0.16]}>
      {STAGE_COLORS.map((color, index) => (
        <group key={color} position={[0, 0, 1.9 - index * 1.25]}
          onClick={(event) => { event.stopPropagation(); onStageChange(index); }}>
          {([[-1.25, 0, 0], [1.25, 0, 0], [0, 1.25, 0], [0, -1.25, 0]] as [number, number, number][]).map((position, side) => (
            <RoundedBox key={side} position={position} args={side < 2 ? [0.32, 2.82, 0.4] : [2.2, 0.32, 0.4]} radius={0.12} smoothness={4}>
              <meshPhysicalMaterial color={color} metalness={0.45} roughness={0.24} clearcoat={1}
                emissive="#88baff" emissiveIntensity={activeStage === index ? 0.24 : 0.01} />
            </RoundedBox>
          ))}
          <mesh position={[0, 0, -0.03]}>
            <planeGeometry args={[2.15, 2.15]} />
            <meshPhysicalMaterial color={color} transparent opacity={activeStage === index ? 0.16 : 0.06} roughness={0.1} metalness={0.1} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {[0, 1, 2].map((dot) => <mesh key={dot} position={[-0.3 + dot * 0.3, -1.25, 0.23]}><sphereGeometry args={[0.035, 10, 10]} /><meshBasicMaterial color={activeStage === index ? "#e8f5ff" : "#52739d"} /></mesh>)}
        </group>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 7, 8]} /><meshBasicMaterial color="#b1d7ff" transparent opacity={0.65} />
      </mesh>
      <mesh ref={signal} position={[0, 0, 2.8]}><icosahedronGeometry args={[0.17, 1]} /><meshStandardMaterial color="#f0f8ff" emissive="#a8d2ff" emissiveIntensity={1.6} /></mesh>
      {[0, 1, 2].map((index) => <RoundedBox key={index} position={[0, 0, 3.1 + index * 0.22]} args={[1.45, 1.45, 0.08]} radius={0.1} smoothness={3}><meshStandardMaterial color="#d9e9fc" metalness={0.6} roughness={0.23} transparent opacity={0.65 - index * 0.15} /></RoundedBox>)}
    </group>
  );
}
export function HeroPreviewCanvas({ activeStage = 0, onStageChange = () => {}, paused = false }: { activeStage?: number; onStageChange?: (stage: number) => void; paused?: boolean }) {
  return (
    <SceneCanvas label="Illustrative four-stage pipeline. Drag to rotate. Use the numbered stage buttons to inspect each stage." animate={!paused} camera={{ position: [5.8, 4.3, 8.2], fov: 39 }}>
      <StudioLights />
      <Assembly activeStage={activeStage} onStageChange={onStageChange} />
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.4} maxPolarAngle={2.2} />
    </SceneCanvas>
  );
}
