import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF } from "@react-three/drei";
import "./ModelViewer.css";

// Компонент для загрузки и отображения 3D модели
function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1} />;
}

// Компонент для отображения сцены
function Scene({ modelUrl }) {
  return (
    <>
      {/* Освещение */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />

      {/* Окружение */}
      <Environment preset="sunset" />

      {/* 3D модель */}
      {modelUrl && (
        <Suspense fallback={null}>
          <Model url={modelUrl} />
        </Suspense>
      )}

      {/* Геометрическая фигура по умолчанию, если модель не загружена */}
      {!modelUrl && (
        <mesh>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#3390ec" />
        </mesh>
      )}

      {/* Управление камерой (вращение, масштабирование) */}
      <OrbitControls
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={10}
      />
    </>
  );
}

function ModelViewer({ modelUrl }) {
  return (
    <div className="model-viewer-container">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene modelUrl={modelUrl} />
      </Canvas>
    </div>
  );
}

export default ModelViewer;

