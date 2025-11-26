import { Suspense, useState, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import "./ModelViewer.css";

// Компонент для обработки кликов через raycaster
function ClickHandler({ onPartClick }) {
  const { camera, gl, raycaster, scene } = useThree();
  const [hovered, setHovered] = useState(null);
  const pointerDownRef = useRef(null);
  const hasMovedRef = useRef(false);
  const pointerDownTimeRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const clientX = event.clientX || (event.touches?.[0]?.clientX);
      const clientY = event.clientY || (event.touches?.[0]?.clientY);
      
      if (clientX !== undefined && clientY !== undefined) {
        pointerDownRef.current = { x: clientX, y: clientY };
        hasMovedRef.current = false;
        pointerDownTimeRef.current = Date.now();
      }
    };

    const handlePointerMove = (event) => {
      // Проверяем, было ли движение мыши с момента нажатия
      if (pointerDownRef.current) {
        const clientX = event.clientX || (event.touches?.[0]?.clientX);
        const clientY = event.clientY || (event.touches?.[0]?.clientY);
        
        if (clientX !== undefined && clientY !== undefined) {
          const dx = Math.abs(clientX - pointerDownRef.current.x);
          const dy = Math.abs(clientY - pointerDownRef.current.y);
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Если движение больше 8 пикселей, считаем это drag
          if (distance > 8) {
            hasMovedRef.current = true;
          }
        }
      }

      // Обновляем hover состояние только если не идет drag
      if (!pointerDownRef.current) {
        const mouse = new THREE.Vector2();
        const rect = gl.domElement.getBoundingClientRect();
        const clientX = event.clientX || (event.touches?.[0]?.clientX);
        const clientY = event.clientY || (event.touches?.[0]?.clientY);
        
        if (clientX !== undefined && clientY !== undefined) {
          mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(scene.children, true);

          const hoveredObject = intersects.find(i => i.object.isMesh && i.object.userData.isClickable)?.object || null;
          setHovered(hoveredObject);
        }
      }
    };

    const handlePointerUp = (event) => {
      // Проверяем, был ли это клик (не drag)
      if (pointerDownRef.current && !hasMovedRef.current) {
        // Проверяем время - если между нажатием и отпусканием прошло слишком много времени, это не клик
        const timeDiff = pointerDownTimeRef.current ? Date.now() - pointerDownTimeRef.current : 0;
        if (timeDiff > 300) {
          pointerDownRef.current = null;
          hasMovedRef.current = false;
          pointerDownTimeRef.current = null;
          return;
        }

        // Проверяем финальную позицию - если она сильно отличается от начальной, это был drag
        const clientX = event.clientX || (event.changedTouches?.[0]?.clientX);
        const clientY = event.clientY || (event.changedTouches?.[0]?.clientY);
        
        if (clientX !== undefined && clientY !== undefined && pointerDownRef.current) {
          const dx = Math.abs(clientX - pointerDownRef.current.x);
          const dy = Math.abs(clientY - pointerDownRef.current.y);
          const finalDistance = Math.sqrt(dx * dx + dy * dy);
          
          // Если финальное расстояние больше 5 пикселей, это был drag
          if (finalDistance > 5) {
            pointerDownRef.current = null;
            hasMovedRef.current = false;
            pointerDownTimeRef.current = null;
            return;
          }
        }

        // Нормализуем координаты
        const mouse = new THREE.Vector2();
        const rect = gl.domElement.getBoundingClientRect();
        
        if (clientX !== undefined && clientY !== undefined) {
          mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(scene.children, true);

          // Находим первый кликабельный объект
          for (const intersect of intersects) {
            const object = intersect.object;
            if (object.isMesh && object.userData.isClickable) {
              const partName = object.userData.partName || object.name || "Unknown Part";
              console.log("Клик обнаружен на:", partName);
              if (onPartClick) {
                onPartClick(partName, intersect);
              }
              break;
            }
          }
        }
      }

      // Сбрасываем состояние при отпускании кнопки
      pointerDownRef.current = null;
      hasMovedRef.current = false;
      pointerDownTimeRef.current = null;
    };

    const handleClick = (event) => {
      // Игнорируем событие click, используем только pointerup
      event.preventDefault();
      event.stopPropagation();
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown, { passive: true });
    gl.domElement.addEventListener("pointermove", handlePointerMove, { passive: true });
    gl.domElement.addEventListener("pointerup", handlePointerUp, { passive: true });
    gl.domElement.addEventListener("click", handleClick, { passive: false });
    gl.domElement.addEventListener("touchstart", handlePointerDown, { passive: true });
    gl.domElement.addEventListener("touchmove", handlePointerMove, { passive: true });
    gl.domElement.addEventListener("touchend", handlePointerUp, { passive: true });

    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("pointerup", handlePointerUp);
      gl.domElement.removeEventListener("click", handleClick);
      gl.domElement.removeEventListener("touchstart", handlePointerDown);
      gl.domElement.removeEventListener("touchmove", handlePointerMove);
      gl.domElement.removeEventListener("touchend", handlePointerUp);
    };
  }, [camera, gl, raycaster, scene, onPartClick]);

  useFrame(() => {
    gl.domElement.style.cursor = hovered ? "pointer" : "auto";
  });

  return null;
}

// Компонент для загрузки и отображения 3D модели с поддержкой кликов
function Model({ url, onPartClick, selectedPart }) {
  const { scene } = useGLTF(url);
  const originalMaterials = useRef(new Map());

  // Собираем все меши и настраиваем их
  useEffect(() => {
    const materialsMap = new Map();
    let meshCount = 0;

    scene.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        if (child.material) {
          materialsMap.set(child.uuid, child.material.clone());
          child.userData.isClickable = true;
          child.userData.partName = child.name || `Part_${child.uuid.slice(0, 8)}`;
        }
      }
    });

    originalMaterials.current = materialsMap;
    console.log(`Модель загружена: ${meshCount} мешей, ${materialsMap.size} с материалами`);
  }, [scene]);

  // Применяем выделение к выбранной части
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        const originalMaterial = originalMaterials.current.get(child.uuid);
        
        if (selectedPart === child.userData.partName && originalMaterial) {
          const highlightMaterial = new THREE.MeshStandardMaterial({
            color: 0x3390ec,
            emissive: 0x003366,
            emissiveIntensity: 0.3,
            metalness: 0.3,
            roughness: 0.2,
          });
          
          if (Array.isArray(child.material)) {
            child.material = child.material.map(() => highlightMaterial.clone());
          } else {
            child.material = highlightMaterial;
          }
        } else if (originalMaterial && selectedPart !== child.userData.partName) {
          child.material = originalMaterial.clone();
        }
      }
    });
  }, [selectedPart, scene]);

  return <primitive object={scene} scale={1} />;
}

// Компонент для одного сегмента стороны куба
function CubeSegment({ 
  sideName, 
  segmentIndex, 
  row, 
  col, 
  position, 
  rotation,
  segmentSize,
  onPartClick, 
  selectedPart,
  segmentTextures // Map с URL изображений для сегментов
}) {
  const [hovered, setHovered] = useState(false);
  const [texture, setTexture] = useState(null);
  const segmentRef = useRef();
  const materialRef = useRef();
  const pointerDownRef = useRef(null);
  const hasMovedRef = useRef(false);
  
  // Название сегмента: например, "Передняя - Сегмент (1,1)"
  const segmentName = `${sideName} - Сегмент (${row + 1},${col + 1})`;
  const textureUrl = segmentTextures?.get(segmentName);

  useEffect(() => {
    if (segmentRef.current) {
      segmentRef.current.userData.isClickable = true;
      segmentRef.current.userData.partName = segmentName;
    }
  }, [segmentName]);

  // Загружаем текстуру, если она есть для этого сегмента
  useEffect(() => {
    let currentTexture = null;

    if (textureUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        textureUrl,
        (loadedTexture) => {
          currentTexture = loadedTexture;
          setTexture(loadedTexture);
          if (materialRef.current) {
            materialRef.current.map = loadedTexture;
            materialRef.current.needsUpdate = true;
          }
        },
        undefined,
        (error) => {
          console.error(`Ошибка загрузки текстуры для ${segmentName}:`, error);
        }
      );
    } else {
      setTexture(null);
      if (materialRef.current) {
        materialRef.current.map = null;
        materialRef.current.needsUpdate = true;
      }
    }

    // Очистка при размонтировании или изменении URL
    return () => {
      if (currentTexture) {
        currentTexture.dispose();
      }
    };
  }, [textureUrl, segmentName]);

  // Обновляем цвет материала напрямую, не создавая новый материал
  useEffect(() => {
    if (materialRef.current && !texture) {
      // Меняем цвет только если нет текстуры
      if (selectedPart === segmentName) {
        materialRef.current.color.setHex(0x0066cc);
      } else if (hovered) {
        materialRef.current.color.setHex(0x4499ff);
      } else {
        materialRef.current.color.setHex(0x3390ec);
      }
    } else if (materialRef.current && texture) {
      // Если есть текстура, используем белый цвет чтобы текстура отображалась корректно
      materialRef.current.color.setHex(0xffffff);
    }
  }, [selectedPart, hovered, segmentName, texture]);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    const clientX = e.clientX || (e.touches?.[0]?.clientX);
    const clientY = e.clientY || (e.touches?.[0]?.clientY);
    
    if (clientX !== undefined && clientY !== undefined) {
      pointerDownRef.current = { x: clientX, y: clientY };
      hasMovedRef.current = false;
    }
  };

  const handlePointerMove = (e) => {
    // Проверяем, было ли движение мыши с момента нажатия
    if (pointerDownRef.current) {
      const clientX = e.clientX || (e.touches?.[0]?.clientX);
      const clientY = e.clientY || (e.touches?.[0]?.clientY);
      
      if (clientX !== undefined && clientY !== undefined) {
        const dx = Math.abs(clientX - pointerDownRef.current.x);
        const dy = Math.abs(clientY - pointerDownRef.current.y);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Если движение больше 8 пикселей, считаем это drag
        if (distance > 8) {
          hasMovedRef.current = true;
        }
      }
    }
  };

  const handlePointerUp = (e) => {
    e.stopPropagation();
    
    // Если было движение, это не клик, а завершение drag
    if (!pointerDownRef.current) {
      return;
    }

    // Проверяем финальную позицию - если она сильно отличается от начальной, это был drag
    const clientX = e.clientX || (e.changedTouches?.[0]?.clientX);
    const clientY = e.clientY || (e.changedTouches?.[0]?.clientY);
    
    if (clientX !== undefined && clientY !== undefined && pointerDownRef.current) {
      const dx = Math.abs(clientX - pointerDownRef.current.x);
      const dy = Math.abs(clientY - pointerDownRef.current.y);
      const finalDistance = Math.sqrt(dx * dx + dy * dy);
      
      // Если финальное расстояние больше 5 пикселей, это был drag
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

    console.log(`Клик по сегменту: ${segmentName}`);
    if (onPartClick) {
      const intersect = {
        object: segmentRef.current,
        point: e.point || new THREE.Vector3(),
        distance: e.distance || 0,
      };
      onPartClick(segmentName, intersect);
    }

    pointerDownRef.current = null;
    hasMovedRef.current = false;
  };

  const handleClick = (e) => {
    // Игнорируем событие click, используем только pointerup
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <mesh
      ref={segmentRef}
      position={position}
      rotation={rotation}
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
      <planeGeometry args={[segmentSize, segmentSize]} />
      <meshStandardMaterial 
        ref={materialRef}
        color={0x3390ec}
        side={THREE.DoubleSide}
        wireframe={false}
        map={texture}
      />
    </mesh>
  );
}

// Компонент для одной стороны куба, разделенной на сегменты
function CubeSide({ 
  name, 
  position, 
  rotation, 
  onPartClick, 
  selectedPart,
  segmentsPerSide = 20, // Количество сегментов по одной стороне (20x20 = 400 сегментов)
  segmentTextures // Map с URL изображений для сегментов
}) {
  const size = 2; // Размер стороны куба
  const segmentSize = size / segmentsPerSide; // Размер одного сегмента
  const offset = (size - segmentSize) / 2; // Смещение для центрирования

  const segments = [];

  // Создаем сетку сегментов в локальных координатах
  for (let row = 0; row < segmentsPerSide; row++) {
    for (let col = 0; col < segmentsPerSide; col++) {
      // Вычисляем локальную позицию сегмента на плоскости (от центра)
      const localX = -offset + col * segmentSize;
      const localY = offset - row * segmentSize;

      const segmentIndex = row * segmentsPerSide + col;

      segments.push(
        <CubeSegment
          key={`${name}-${row}-${col}`}
          sideName={name}
          segmentIndex={segmentIndex}
          row={row}
          col={col}
          position={[localX, localY, 0]}
          rotation={[0, 0, 0]}
          segmentSize={segmentSize}
          onPartClick={onPartClick}
          selectedPart={selectedPart}
          segmentTextures={segmentTextures}
        />
      );
    }
  }

  // Используем группу для позиционирования и поворота всей стороны
  return (
    <group position={position} rotation={rotation}>
      {segments}
    </group>
  );
}

// Кликабельный куб, состоящий из 6 отдельных сторон
function ClickableBox({ onPartClick, selectedPart, segmentTextures }) {
  const size = 2;
  const halfSize = size / 2;

  // Определяем позиции и повороты для каждой стороны куба
  const sides = [
    {
      name: "Передняя",
      position: [0, 0, halfSize],
      rotation: [0, 0, 0],
    },
    {
      name: "Задняя",
      position: [0, 0, -halfSize],
      rotation: [0, Math.PI, 0],
    },
    {
      name: "Верхняя",
      position: [0, halfSize, 0],
      rotation: [-Math.PI / 2, 0, 0],
    },
    {
      name: "Нижняя",
      position: [0, -halfSize, 0],
      rotation: [Math.PI / 2, 0, 0],
    },
    {
      name: "Правая",
      position: [halfSize, 0, 0],
      rotation: [0, -Math.PI / 2, 0],
    },
    {
      name: "Левая",
      position: [-halfSize, 0, 0],
      rotation: [0, Math.PI / 2, 0],
    },
  ];

  return (
    <group>
      {sides.map((side) => (
        <CubeSide
          key={side.name}
          name={side.name}
          position={side.position}
          rotation={side.rotation}
          onPartClick={onPartClick}
          selectedPart={selectedPart}
          segmentsPerSide={20}
          segmentTextures={segmentTextures}
        />
      ))}
    </group>
  );
}

// Компонент для установки фиксированного фона
function BackgroundColor() {
  const { gl } = useThree();
  
  useEffect(() => {
    // Устанавливаем фиксированный белый фон
    gl.setClearColor(0xffffff, 1);
  }, [gl]);

  // Постоянно поддерживаем белый фон в каждом кадре
  useFrame(() => {
    gl.setClearColor(0xffffff, 1);
  });

  return null;
}

// Компонент для отображения сцены
function Scene({ modelUrl, onPartClick, selectedPart, segmentTextures }) {
  return (
    <>
      {/* Фиксированный цвет фона сцены */}
      <BackgroundColor />
      
      {/* Освещение */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />

      {/* Окружение (отключено для стабильности цвета) */}
      {/* <Environment preset="sunset" /> */}

      {/* 3D модель */}
      {modelUrl && (
        <Suspense fallback={null}>
          <Model url={modelUrl} onPartClick={onPartClick} selectedPart={selectedPart} />
        </Suspense>
      )}

      {/* Геометрическая фигура по умолчанию, если модель не загружена */}
      {!modelUrl && (
        <ClickableBox 
          onPartClick={onPartClick}
          selectedPart={selectedPart}
          segmentTextures={segmentTextures}
        />
      )}

      {/* Обработчик кликов */}
      <ClickHandler onPartClick={onPartClick} />

      {/* Управление камерой (вращение, масштабирование) */}
      <OrbitControls
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        minDistance={0.3}
        maxDistance={15}
      />
    </>
  );
}

function ModelViewer({ modelUrl, onPartClick, selectedPart, segmentTextures }) {
  return (
    <div className="model-viewer-container">
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 50 }}
        style={{ width: "100%", height: "100%", background: "#ffffff" }}
        gl={{ 
          preserveDrawingBuffer: false,
          alpha: false, // Отключаем прозрачность для стабильного фона
        }}
        onCreated={({ gl, scene }) => {
          // Устанавливаем фиксированный цвет фона
          gl.setClearColor(0xffffff, 1);
          // Отключаем autoClear, чтобы фон не менялся
          gl.autoClear = true;
        }}
      >
        <Scene 
          modelUrl={modelUrl} 
          onPartClick={onPartClick} 
          selectedPart={selectedPart}
          segmentTextures={segmentTextures}
        />
      </Canvas>
    </div>
  );
}

export default ModelViewer;
