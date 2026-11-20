/**
 * ModelViewer — 360° orbitable product view.
 *
 * Two sources:
 *   1. product.modelUrl — a GLB/GLTF the admin uploaded (object URL for the session).
 *   2. No upload yet — a studio placeholder primitive chosen by product.variant,
 *      so the 3D experience is visible before the client supplies models.
 */

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import type { ModelVariant, Product } from "@/lib/types";

type ViewerBoundaryProps = { children: ReactNode; fallback: ReactNode };

/**
 * A broken or CORS-blocked GLB must never take down the product route. The
 * viewer degrades to a static panel and the gallery stays usable.
 */
export class ViewerBoundary extends Component<ViewerBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("3D model failed to load; showing a static fallback.", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type ProbeState = "none" | "checking" | "ready" | "failed";

/**
 * The uploaded GLB usually lives on the studio's file host, which only allows
 * the production origin through CORS. Any other deployment (preview, custom
 * domain) gets a blocked fetch, and three.js throws that straight into the
 * route. Probe the file first so an unreachable model never reaches the loader.
 */
export function useModelProbe(url?: string): ProbeState {
  const [state, setState] = useState<ProbeState>(url ? "checking" : "none");

  useEffect(() => {
    if (!url) {
      setState("none");
      return;
    }

    // In-session object URLs cannot be probed with HEAD, and need no check.
    if (/^(blob:|data:)/i.test(url)) {
      setState("ready");
      return;
    }

    setState("checking");
    const controller = new AbortController();
    let active = true;

    fetch(url, { method: "HEAD", signal: controller.signal })
      .then((response) => {
        if (!active) return;
        // A HEAD the host does not implement says nothing about the file.
        setState(response.ok || response.status === 405 ? "ready" : "failed");
      })
      .catch(() => {
        // Network down, or the response was not exposed to this origin.
        if (active) setState("failed");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [url]);

  return state;
}

function ModelFallback({ image }: { image?: string }) {
  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden bg-[color:var(--surface-soft)]">
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      ) : (
        <span
          aria-hidden
          className="h-24 w-24 rounded-[28px]"
          style={{ background: "radial-gradient(70% 70% at 35% 25%, #ffe98a, #5f7d00)" }}
        />
      )}
      <div className="relative m-4 max-w-[270px] rounded-2xl border border-white/10 bg-[#111311] px-4 py-3 text-center shadow-lg">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffd814]">
          3D preview unavailable
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#d6dacf]">
          Use the gallery images, or reload once the model file is reachable.
        </p>
      </div>
    </div>
  );
}

function CanvasFailureNotice({ onFail }: { onFail: () => void }) {
  useEffect(() => {
    onFail();
  }, [onFail]);
  return null;
}

function UploadedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} />;
}

function Placeholder({ variant, accent }: { variant: ModelVariant; accent: string }) {
  const material = (
    <meshStandardMaterial color={accent} metalness={0.32} roughness={0.28} />
  );

  switch (variant) {
    case "dragon":
      return (
        <group rotation={[0.2, 0.6, 0.1]}>
          <mesh position={[0, 0.35, 0]}>
            <icosahedronGeometry args={[0.72, 1]} />
            {material}
          </mesh>
          <mesh position={[0, -0.42, 0]} rotation={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.34, 0.5, 0.5, 8]} />
            {material}
          </mesh>
        </group>
      );
    case "organiser":
      return (
        <group rotation={[0.15, 0.5, 0]}>
          {[-0.4, 0, 0.4].map((x) =>
            [-0.35, 0.35].map((z) => (
              <mesh key={`${x}-${z}`} position={[x, 0.2, z]}>
                <cylinderGeometry args={[0.26, 0.26, 0.75, 6]} />
                {material}
              </mesh>
            )),
          )}
          <mesh position={[0, -0.24, 0]}>
            <boxGeometry args={[1.5, 0.14, 1.1]} />
            {material}
          </mesh>
        </group>
      );
    case "gear":
      return (
        <group rotation={[0.5, 0.3, 0]}>
          <mesh>
            <torusKnotGeometry args={[0.62, 0.2, 128, 20]} />
            {material}
          </mesh>
        </group>
      );
    case "planter":
      return (
        <group>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.62, 0.44, 0.85, 8]} />
            {material}
          </mesh>
          <mesh position={[0, -0.44, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 0.1, 8]} />
            {material}
          </mesh>
        </group>
      );
    case "knight":
      return (
        <group rotation={[0.1, 0.6, 0]}>
          <mesh position={[0, 0.18, 0]}>
            <coneGeometry args={[0.42, 0.9, 6]} />
            {material}
          </mesh>
          <mesh position={[0, -0.36, 0]}>
            <boxGeometry args={[0.72, 0.16, 0.72]} />
            {material}
          </mesh>
        </group>
      );
    case "spool":
      return (
        <group rotation={[0.35, 0.4, 0]}>
          <mesh>
            <cylinderGeometry args={[0.7, 0.7, 0.55, 32]} />
            {material}
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.72, 0.72, 0.08, 32]} />
            {material}
          </mesh>
        </group>
      );
    case "lattice":
    default:
      return (
        <group rotation={[0.18, 0.55, 0]}>
          <mesh>
            <dodecahedronGeometry args={[0.85, 0]} />
            {material}
          </mesh>
        </group>
      );
  }
}

type ModelViewerProps = {
  /** Full product (storefront). */
  product?: Product;
  /** Or pass the pieces directly (admin product form preview). */
  variant?: ModelVariant;
  accent?: string;
  modelUrl?: string;
  className?: string;
  heightClass?: string;
  autoRotate?: boolean;
};

export function ModelViewer({
  product,
  variant,
  accent,
  modelUrl,
  className,
  heightClass,
  autoRotate = true,
}: ModelViewerProps) {
  const shape = variant ?? product?.variant ?? "lattice";
  const tint = accent ?? product?.accent ?? "#a78bfa";
  const requestedUrl = modelUrl ?? product?.modelUrl;
  const probe = useModelProbe(requestedUrl);
  const url = probe === "ready" ? requestedUrl : undefined;
  const fallbackImage = product?.images?.[0] ?? product?.imageUrl;
  const [canvasFailed, setCanvasFailed] = useState(false);
  const markCanvasFailed = useCallback(() => setCanvasFailed(true), []);

  // A new model target deserves a fresh attempt at the canvas.
  useEffect(() => setCanvasFailed(false), [requestedUrl]);

  if (probe === "failed" || canvasFailed) {
    return (
      <div className={className ?? heightClass ?? "h-[380px] w-full"}>
        <ModelFallback image={fallbackImage} />
      </div>
    );
  }

  if (probe === "checking") {
    return (
      <div className={className ?? heightClass ?? "h-[380px] w-full"}>
        <div className="skeleton h-full w-full" aria-label="Loading 3D preview" />
      </div>
    );
  }

  return (
    <div className={className ?? heightClass ?? "h-[380px] w-full"}>
      <ViewerBoundary
        key={url ?? "placeholder"}
        fallback={<ModelFallback image={fallbackImage} />}
      >
        <Canvas
        className="cursor-grab active:cursor-grabbing"
        camera={{ position: [0, 0.4, 3.4], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 6, 5]} intensity={1.6} />
        <directionalLight position={[-5, -2, -4]} intensity={0.45} />
        {/* Scene errors surface inside the canvas root, not in the DOM above it. */}
        <Suspense fallback={null}>
          <ViewerBoundary
            key={url ?? "placeholder"}
            fallback={<CanvasFailureNotice onFail={markCanvasFailed} />}
          >
            <Bounds fit clip observe margin={1.25}>
              {url ? (
                <UploadedModel url={url} />
              ) : (
                <Placeholder variant={shape} accent={tint} />
              )}
            </Bounds>
          </ViewerBoundary>
        </Suspense>
        <ContactShadows
          position={[0, -1.05, 0]}
          opacity={0.45}
          scale={7}
          blur={2.4}
          far={3}
        />
        <OrbitControls
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={1.1}
          minDistance={2}
          maxDistance={6}
        />
        </Canvas>
      </ViewerBoundary>
    </div>
  );
}
