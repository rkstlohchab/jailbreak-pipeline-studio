"use client";
import { Component, createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import { Box } from "lucide-react";

const MotionContext = createContext(false);
export const useSceneMotion = () => useContext(MotionContext);

export function SceneFallback() {
  return <div className="scene-fallback" role="status"><Box size={40} strokeWidth={1} /><strong>3D preview unavailable</strong><span>Enable WebGL to explore this scene. The workspace navigation and data remain available.</span></div>;
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <SceneFallback /> : this.props.children; }
}
function SceneReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}
export function SceneCanvas({ children, label, animate = true, ...props }: CanvasProps & { label: string; animate?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduced(query.matches);
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    updateMotion(); updateVisibility();
    query.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (host.current) observer.observe(host.current);
    return () => {
      query.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
      observer.disconnect();
    };
  }, []);
  const markReady = useCallback(() => setReady(true), []);
  const motion = animate && !reduced && visible && pageVisible;
  return (
    <div ref={host} className="scene-host" data-scene-ready={ready} data-motion={motion ? "active" : "paused"}>
      <SceneBoundary>
        <Canvas dpr={[1, 1.5]} frameloop={motion ? "always" : "demand"} fallback={<SceneFallback />}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => { gl.domElement.setAttribute("role", "img"); gl.domElement.setAttribute("aria-label", label); }} {...props}>
          <MotionContext.Provider value={motion}>{children}<SceneReady onReady={markReady} /></MotionContext.Provider>
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
export function StudioLights() {
  return <>
    <ambientLight intensity={0.9} />
    <hemisphereLight args={["#cce5ff", "#202b3c", 1.5]} />
    <directionalLight position={[4, 8, 6]} intensity={3.2} color="#e5f1ff" />
    <directionalLight position={[-6, 2, -4]} intensity={2.5} color="#7aa8e7" />
    <pointLight position={[0, -2, 5]} intensity={12} color="#a2c8ff" />
  </>;
}
