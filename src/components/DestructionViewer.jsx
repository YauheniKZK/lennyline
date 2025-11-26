import { Suspense, useState, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import "./ModelViewer.css";

// Компонент для одного маленького кубика
function SmallCube({
  position,
  onCubeClick,
  isRemoved,
  cubeId,
}) {
  const cubeRef = useRef();
  const [hovered, setHovered] = useState(false);
  const pointerDownRef = useRef(null);
  const hasMovedRef = useRef(false);

  useEffect(() => {
    if (cubeRef.current) {
      cubeRef.current.userData.isClickable = true;
      cubeRef.current.userData.cubeId = cubeId;
    }
  }, [cubeId]);

  // Если кубик удален, не рендерим его
  if (isRemoved) {
    return null;
  }

  const handlePointerDown = (e) => {
    e.stopPropagation();
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;

    if (clientX !== undefined && clientY !== undefined) {
      pointerDownRef.current = { x: clientX, y: clientY };
      hasMovedRef.current = false;
    }
  };

  const handlePointerMove = (e) => {
    if (pointerDownRef.current) {
      const clientX = e.clientX || e.touches?.[0]?.clientX;
      const clientY = e.clientY || e.touches?.[0]?.clientY;

      if (clientX !== undefined && clientY !== undefined) {
        const dx = Math.abs(clientX - pointerDownRef.current.x);
        const dy = Math.abs(clientY - pointerDownRef.current.y);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 8) {
          hasMovedRef.current = true;
        }
      }
    }
  };

  const handlePointerUp = (e) => {
    e.stopPropagation();

    if (!pointerDownRef.current) {
      return;
    }

    const clientX = e.clientX || e.changedTouches?.[0]?.clientX;
    const clientY = e.clientY || e.changedTouches?.[0]?.clientY;

    if (
      clientX !== undefined &&
      clientY !== undefined &&
      pointerDownRef.current
    ) {
      const dx = Math.abs(clientX - pointerDownRef.current.x);
      const dy = Math.abs(clientY - pointerDownRef.current.y);
      const finalDistance = Math.sqrt(dx * dx + dy * dy);

      if (finalDistance > 5 || hasMovedRef.current) {
        pointerDownRef.current = null;
        hasMovedRef.current = false;
        return;
      }
    }

    if (hasMovedRef.current) {
      pointerDownRef.current = null;
      hasMovedRef.current = false;
      return;
    }

    if (onCubeClick) {
      onCubeClick(cubeId);
    }

    pointerDownRef.current = null;
    hasMovedRef.current = false;
  };

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  // Цвет кубика
  const cubeColor = hovered ? 0x66ccff : 0x3390ec;

  return (
    <mesh
      ref={cubeRef}
      position={position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      onPointerCancel={handlePointerUp}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={cubeColor} />
    </mesh>
  );
}

// Компонент для установки фиксированного фона
function BackgroundColor() {
  const { gl } = useThree();

  useEffect(() => {
    gl.setClearColor(0xffffff, 1);
  }, [gl]);

  useFrame(() => {
    gl.setClearColor(0xffffff, 1);
  });

  return null;
}

// Компонент для отображения сцены с кубом из кубиков
function DestructionScene({
  onCubeClick,
  removedCubes,
  cubeSize = 5, // Размер большого куба (5x5x5 = 125 маленьких кубиков)
}) {
  const cubeSpacing = 1.05; // Небольшой отступ между кубиками
  const offset = ((cubeSize - 1) * cubeSpacing) / 2;

  // Генерируем все кубики
  const cubes = [];
  let cubeId = 0;

  for (let x = 0; x < cubeSize; x++) {
    for (let y = 0; y < cubeSize; y++) {
      for (let z = 0; z < cubeSize; z++) {
        const position = [
          x * cubeSpacing - offset,
          y * cubeSpacing - offset,
          z * cubeSpacing - offset,
        ];
        cubes.push({
          id: cubeId++,
          position,
        });
      }
    }
  }

  return (
    <>
      <BackgroundColor />

      {/* Освещение */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, -10, -5]} intensity={0.5} />
      <pointLight position={[0, 0, 10]} intensity={0.3} />

      {/* Куб из маленьких кубиков */}
      <group>
        {cubes.map((cube) => (
          <SmallCube
            key={cube.id}
            position={cube.position}
            onCubeClick={onCubeClick}
            isRemoved={removedCubes.has(cube.id)}
            cubeId={cube.id}
          />
        ))}
      </group>

      {/* Управление камерой */}
      <OrbitControls
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={20}
      />
    </>
  );
}

function DestructionViewer({ onCubeClick, removedCubes, cubeSize = 5 }) {
  return (
    <div className="model-viewer-container">
      <Canvas
        camera={{ position: [8, 8, 8], fov: 50 }}
        style={{ width: "100%", height: "100%", background: "#ffffff" }}
        gl={{
          preserveDrawingBuffer: false,
          alpha: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0xffffff, 1);
          gl.autoClear = true;
        }}
      >
        <DestructionScene
          onCubeClick={onCubeClick}
          removedCubes={removedCubes}
          cubeSize={cubeSize}
        />
      </Canvas>
    </div>
  );
}

export default DestructionViewer;

