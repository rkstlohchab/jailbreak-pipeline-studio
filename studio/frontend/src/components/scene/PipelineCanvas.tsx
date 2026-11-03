"use client";
import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Stars } from "@react-three/drei";
import * as THREE from "three";

export type PipelineCameraMode = "orbit" | "pan";
import { PromptStack } from "./PromptStack";
import { Gate } from "./Gate";
import { TokenStream } from "./TokenStream";
import { VerdictBadge } from "./VerdictBadge";
import { usePipelineStore } from "@/state/pipelineStore";

function GateRow() {
  return (
    <>
      <Gate kind="gate_1_rlhf" />
      <Gate kind="gate_2_reasoning" />
      <Gate kind="gate_3_policy" />
      <Gate kind="gate_4_classifier_mw" />
    </>
  );
}

function PromptStackMounted() {
  const traj = usePipelineStore((s) => s.trajectory);
  if (!traj) return null;
  return <PromptStack scores={traj.prompt_scaffold.architecture_scores} />;
}

function TokenStreamMounted() {
  const current = usePipelineStore((s) => s.currentEvent());
  const active =
    current?.phase === "tokens" ||
    current?.phase === "generation_start" ||
    current?.phase === "generation_end";
  const traj = usePipelineStore((s) => s.trajectory);
  const verdict = traj?.outcome.verdict ?? "SHIP";
  const hue =
    verdict === "SHIP" || verdict === "SHIP-narrative" ? 150 :
    verdict === "NO-STAMP (persona lost)" ? 280 :
    verdict.startsWith("REFUSAL") ? 0 : 50;
  return <TokenStream active={active} hue={hue} />;
}

export function PipelineCanvas({
  compact = false,
  mode = "orbit",
}: { compact?: boolean; mode?: PipelineCameraMode } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Compact mode pulls camera back + scales down the scene so it fits inside
  // the center panel of the Playground view without clipping the gate stack.
  const cameraPos: [number, number, number] = compact ? [-2, 3, 14] : [-1, 2, 7.5];
  const fov = compact ? 45 : 50;
  const sceneScale = compact ? 0.72 : 1;
  const maxDist = compact ? 24 : 16;
  const minDist = compact ? 9 : 5;

  return (
    <div ref={containerRef} className="absolute inset-0">
      <Canvas
        camera={{ position: cameraPos, fov }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#070711"]} />
        <fog attach="fog" args={["#070711", 11, 28]} />
        <ambientLight intensity={0.25} />
        <pointLight position={[6, 6, 6]} intensity={1.1} color="#6ee7b7" />
        <pointLight position={[-6, -4, 3]} intensity={0.6} color="#a78bfa" />
        <Stars radius={60} depth={30} count={1500} factor={2.5} fade speed={0.4} />
        <Environment preset="night" />

        <group scale={sceneScale}>
          <PromptStackMounted />
          <GateRow />
          <TokenStreamMounted />
          <VerdictBadge />

          {/* floor plane for subtle grounding */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
            <planeGeometry args={[40, 40]} />
            <meshStandardMaterial
              color="#0b0b1a"
              metalness={0.9}
              roughness={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        <OrbitControls
          enablePan
          panSpeed={1.4}
          screenSpacePanning
          minDistance={minDist}
          maxDistance={maxDist}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0, 0]}
          keys={{ LEFT: "ArrowLeft", RIGHT: "ArrowRight", UP: "ArrowUp", BOTTOM: "ArrowDown" }}
          mouseButtons={
            mode === "pan"
              ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
              : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
          }
        />
      </Canvas>
    </div>
  );
}
