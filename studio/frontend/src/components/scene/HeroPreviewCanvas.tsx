"use client";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Float, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import { api } from "@/lib/api";
import { useSessionStore } from "@/state/sessionStore";
import { usePipelineStore } from "@/state/pipelineStore";
import { PromptStack } from "./PromptStack";
import { Gate } from "./Gate";
import { TokenStream } from "./TokenStream";
import { VerdictBadge } from "./VerdictBadge";

function AutoScrub() {
  const trajectory = usePipelineStore((s) => s.trajectory);
  const setCursor  = usePipelineStore((s) => s.setCursor);
  const start      = useRef<number | null>(null);
  useFrame((state) => {
    if (!trajectory) return;
    if (start.current === null) start.current = state.clock.getElapsedTime();
    const elapsed = state.clock.getElapsedTime() - (start.current ?? 0);
    const cycle = 10;
    const t = (elapsed % cycle) / cycle;
    const idx = Math.floor(t * trajectory.pipeline_events.length);
    setCursor(idx);
  });
  return null;
}

function Scene() {
  const traj = usePipelineStore((s) => s.trajectory);
  if (!traj) return null;
  return (
    <Float speed={1.1} rotationIntensity={0.08} floatIntensity={0.12}>
      <group scale={0.78}>
        <PromptStack scores={traj.prompt_scaffold.architecture_scores} />
        <Gate kind="gate_1_rlhf" />
        <Gate kind="gate_2_reasoning" />
        <Gate kind="gate_3_policy" />
        <Gate kind="gate_4_classifier_mw" />
        <TokenStream active hue={150} />
        <VerdictBadge />
      </group>
    </Float>
  );
}

export function HeroPreviewCanvas() {
  const { sessions, loaded, load } = useSessionStore();
  const current = usePipelineStore((s) => s.trajectory);
  const loadTraj = usePipelineStore((s) => s.load);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!loaded || current || !sessions.length) return;
    void api.sessions.get(sessions[0].trajectory_id).then(loadTraj);
  }, [loaded, current, sessions, loadTraj]);

  return (
    <Canvas camera={{ position: [-1, 2.5, 8.5], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={["#06060f"]} />
      <fog attach="fog" args={["#06060f", 9, 20]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[6, 8, 6]} intensity={1.3} color="#86efac" />
      <pointLight position={[-6, -2, 4]} intensity={0.6} color="#c084fc" />
      <Stars radius={60} depth={30} count={1600} factor={2.3} fade speed={0.35} />

      <Scene />
      <AutoScrub />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.4, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0b0b1a" metalness={0.9} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.4}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
