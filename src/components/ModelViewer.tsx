/**
 * ModelViewer — 360° orbitable product view.
 *
 * Two sources:
 *   1. product.modelUrl — a GLB/GLTF the admin uploaded (object URL for the session).
 *   2. No upload yet — a studio placeholder primitive chosen by product.variant,
 *      so the 3D experience is visible before the client supplies models.
 */

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import type { ModelVariant, Product } from "@/lib/types";

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
  const url = modelUrl ?? product?.modelUrl;

  return (
    <div className={className ?? heightClass ?? "h-[380px] w-full"}>
      <Canvas
        className="cursor-grab active:cursor-grabbing"
        camera={{ position: [0, 0.4, 3.4], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 6, 5]} intensity={1.6} />
        <directionalLight position={[-5, -2, -4]} intensity={0.45} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.25}>
            {url ? (
              <UploadedModel url={url} />
            ) : (
              <Placeholder variant={shape} accent={tint} />
            )}
          </Bounds>
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
    </div>
  );
}
