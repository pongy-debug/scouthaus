import { Suspense, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Group, MathUtils, SRGBColorSpace, TextureLoader } from "three";

function Earth({ entering, reducedMotion }: { entering: boolean; reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const surface = useLoader(TextureLoader, "/textures/earth-day.jpg");
  const clouds = useLoader(TextureLoader, "/textures/earth-clouds.png");
  surface.colorSpace = SRGBColorSpace;
  useFrame(({ camera }, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 0.05);
    if (entering) {
      // Bring northern England towards the camera as the city map opens.
      const targetY = -Math.PI / 2;
      const difference = Math.atan2(Math.sin(targetY - group.current.rotation.y), Math.cos(targetY - group.current.rotation.y));
      group.current.rotation.y += difference * (1 - Math.exp(-dt * 3));
      group.current.rotation.x = MathUtils.damp(group.current.rotation.x, 0.95, 3, dt);
      camera.position.z = MathUtils.damp(camera.position.z, 1.35, 2.2, dt);
    } else if (!reducedMotion) group.current.rotation.y += dt * 0.035;
  });
  return <group ref={group} rotation={[0.2, -1.9, -0.12]}>
    <mesh><sphereGeometry args={[1, 64, 64]} /><meshStandardMaterial map={surface} roughness={0.85} metalness={0.05} /></mesh>
    <mesh><sphereGeometry args={[1.012, 64, 64]} /><meshStandardMaterial map={clouds} transparent opacity={0.35} depthWrite={false} /></mesh>
    <mesh scale={1.025}><sphereGeometry args={[1, 48, 48]} /><meshBasicMaterial color="#7abfff" transparent opacity={0.045} depthWrite={false} /></mesh>
  </group>;
}

export default function CityGlobe({ entering, reducedMotion }: { entering: boolean; reducedMotion: boolean }) {
  return <Canvas camera={{ position: [0, 0, 3.25], fov: 43 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
    <ambientLight intensity={0.2} />
    <directionalLight position={[4, 2, 3]} intensity={2.5} color="#cce8ff" />
    <Suspense fallback={null}><Earth entering={entering} reducedMotion={reducedMotion} /></Suspense>
  </Canvas>;
}
