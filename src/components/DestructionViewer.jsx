import { Suspense, useState, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import "./ModelViewer.css";

// Функция для вибрации в Telegram Mini App
function triggerHapticFeedback() {
  try {
    // Проверяем наличие Telegram WebApp API
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
      // Используем легкую вибрацию для минимального отклика
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
  } catch (error) {
    // Игнорируем ошибки, если API недоступен
    console.log('HapticFeedback недоступен:', error);
  }
}

// Компонент для одного маленького кубика
function SmallCube({
  position,
  onCubeClick,
  damageLevel = 0, // Степень разрушения (0 = нетронутый, hitsToDestroy = разрушен)
  hitsToDestroy = 3,
  cubeId,
}) {
  const cubeRef = useRef();
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const pointerDownRef = useRef(null);
  const hasMovedRef = useRef(false);
  const shakeIntensityRef = useRef(0); // Интенсивность тряски
  const originalPositionRef = useRef(new THREE.Vector3(...position));

  useEffect(() => {
    if (cubeRef.current) {
      cubeRef.current.userData.isClickable = true;
      cubeRef.current.userData.cubeId = cubeId;
    }
    // Сохраняем исходную позицию
    originalPositionRef.current = new THREE.Vector3(...position);
  }, [cubeId, position]);

  // Анимация тряски
  useFrame(() => {
    if (meshRef.current && shakeIntensityRef.current > 0) {
      // Генерируем случайное смещение для тряски
      const shakeAmount = shakeIntensityRef.current * 0.1;
      const offsetX = (Math.random() - 0.5) * shakeAmount;
      const offsetY = (Math.random() - 0.5) * shakeAmount;
      const offsetZ = (Math.random() - 0.5) * shakeAmount;
      
      // Применяем смещение к исходной позиции
      meshRef.current.position.set(
        originalPositionRef.current.x + offsetX,
        originalPositionRef.current.y + offsetY,
        originalPositionRef.current.z + offsetZ
      );
      
      // Уменьшаем интенсивность тряски со временем
      shakeIntensityRef.current *= 0.9;
      
      // Если интенсивность стала очень маленькой, останавливаем тряску
      if (shakeIntensityRef.current < 0.01) {
        shakeIntensityRef.current = 0;
        // Возвращаем кубик в исходную позицию
        meshRef.current.position.copy(originalPositionRef.current);
      }
    }
  });

  // Если кубик полностью разрушен, не рендерим его
  if (damageLevel >= hitsToDestroy) {
    return null;
  }

  // Вычисляем прозрачность в зависимости от степени разрушения
  // Прозрачность увеличивается от 1.0 (полностью непрозрачный) до 0.0 (полностью прозрачный)
  const progress = damageLevel / hitsToDestroy; // 0.0 - 1.0
  const opacity = Math.max(0.0, 1.0 - progress); // От 1.0 до 0.0

  // Цвет кубика остается синим, меняется только прозрачность
  const cubeColor = hovered ? 0x66ccff : 0x3390ec;

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
      // Активируем эффект тряски
      shakeIntensityRef.current = 1.0;
      // Вызываем вибрацию в Telegram Mini App
      triggerHapticFeedback();
      onCubeClick(cubeId);
    }

    pointerDownRef.current = null;
    hasMovedRef.current = false;
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (e.preventDefault && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
  };

  return (
    <mesh
      ref={(ref) => {
        cubeRef.current = ref;
        meshRef.current = ref;
        if (ref) {
          ref.position.set(...position);
        }
      }}
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
      <meshStandardMaterial 
        color={cubeColor} 
        transparent={true}
        opacity={opacity}
      />
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
  cubeDamage, // Map с количеством кликов для каждого кубика
  cubeSize = 5, // Размер большого куба (5x5x5 = 125 маленьких кубиков)
  hitsToDestroy = 3, // Количество кликов для разрушения
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
        {cubes.map((cube) => {
          const damageLevel = cubeDamage.get(cube.id) || 0;
          return (
            <SmallCube
              key={cube.id}
              position={cube.position}
              onCubeClick={onCubeClick}
              damageLevel={damageLevel}
              hitsToDestroy={hitsToDestroy}
              cubeId={cube.id}
            />
          );
        })}
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

function DestructionViewer({ onCubeClick, cubeDamage, cubeSize = 5, hitsToDestroy = 3 }) {
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
          cubeDamage={cubeDamage}
          cubeSize={cubeSize}
          hitsToDestroy={hitsToDestroy}
        />
      </Canvas>
    </div>
  );
}

export default DestructionViewer;

