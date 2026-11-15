import { Suspense, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Group, MathUtils, SRGBColorSpace, TextureLoader } from "three";

function Earth({ entering }: { entering: boolean }) {
  const group = useRef<Group>(null);
  const surface = useLoader(TextureLoader, "/textures/earth-day.jpg");
  surface.colorSpace = SRGBColorSpace;
  useFrame((_, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 0.05);
    if (entering) {
      // Bring northern England towards the camera as the city map opens.
      const targetY = -Math.PI / 2;
      const difference = Math.atan2(Math.sin(targetY - group.current.rotation.y), Math.cos(targetY - group.current.rotation.y));
      group.current.rotation.y += difference * (1 - Math.exp(-dt * 3));
      group.current.rotation.x = MathUtils.damp(group.current.rotation.x, 0.95, 3, dt);
    } else group.current.rotation.y += dt * 0.075;
  });
  return <group ref={group} rotation={[0.15, -1.9, -0.08]}>
    <mesh><sphereGeometry args={[1, 64, 64]} /><meshStandardMaterial map={surface} color="#9bbccc" roughness={1} metalness={0} /></mesh>
    <mesh scale={1.004}><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial color="#a6d6df" wireframe transparent opacity={0.055} depthWrite={false} /></mesh>
    <mesh scale={1.025}><sphereGeometry args={[1, 48, 48]} /><meshBasicMaterial color="#7abfff" transparent opacity={0.045} depthWrite={false} /></mesh>
  </group>;
}

export default function CityGlobe({ entering }: { entering: boolean }) {
  return <Canvas camera={{ position: [0, 0, 3.23], fov: 43 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}>
    <ambientLight intensity={0.65} />
    <directionalLight position={[4, 2, 3]} intensity={1.6} color="#dbf2f5" />
    <pointLight position={[1.05, 1.05, 0.45]} intensity={5.2} distance={1.8} decay={2} color="#d2efff" />
    <pointLight position={[-1.05, -1.05, 0.45]} intensity={2} distance={1.8} decay={2} color="#9bcde8" />
    <Suspense fallback={null}><Earth entering={entering} /></Suspense>
  </Canvas>;
}
