import { Suspense, useState, useRef, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import "./ModelViewer.css";

// Компонент для загрузки и отображения 3D модели с поддержкой кликов
function Model({ url, onPartClick, selectedPart }) {
  const { scene } = useGLTF(url);
  const [parts, setParts] = useState([]);
  const originalMaterials = useRef(new Map());

  // Собираем все меши из модели
  useEffect(() => {
    const meshes = [];
    const materialsMap = new Map();

    scene.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
        // Сохраняем оригинальные материалы
        if (child.material) {
          materialsMap.set(child.uuid, child.material.clone());
          
          // Добавляем обработчик клика на каждый меш
          child.userData.isClickable = true;
          child.userData.partName = child.name || `Part_${child.uuid.slice(0, 8)}`;
        }
      }
    });

    setParts(meshes);
    originalMaterials.current = materialsMap;
  }, [scene]);

  // Восстанавливаем оригинальные материалы для всех частей
  useEffect(() => {
    parts.forEach((mesh) => {
      const originalMaterial = originalMaterials.current.get(mesh.uuid);
      if (originalMaterial) {
        mesh.material = originalMaterial.clone();
      }
    });
  }, [selectedPart, parts]);

  // Выделяем выбранную часть
  useEffect(() => {
    if (selectedPart) {
      parts.forEach((mesh) => {
        if (mesh.userData.partName === selectedPart) {
          // Создаем выделяющий материал (яркий цвет + эмиссия)
          const highlightMaterial = new THREE.MeshStandardMaterial({
            color: 0x3390ec,
            emissive: 0x003366,
            emissiveIntensity: 0.3,
            metalness: 0.3,
            roughness: 0.2,
          });
          
          // Если у меша несколько материалов, используем первый
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map(() => highlightMaterial.clone());
          } else {
            mesh.material = highlightMaterial;
          }
        }
      });
    }
  }, [selectedPart, parts]);

  return <primitive object={scene} scale={1} />;
}

// Компонент для обработки кликов
function ClickHandler({ onPartClick }) {
  const { camera, gl, raycaster, scene } = useThree();
  const [hovered, setHovered] = useState(null);

  useFrame(() => {
    // Изменяем курсор при наведении
    gl.domElement.style.cursor = hovered ? "pointer" : "auto";
  });

  useEffect(() => {
    const handleClick = (event) => {
      // Нормализуем координаты мыши/тача
      const mouse = new THREE.Vector2();
      const rect = gl.domElement.getBoundingClientRect();
      
      // Поддержка как мыши, так и touch событий
      const clientX = event.clientX || (event.changedTouches && event.changedTouches[0]?.clientX);
      const clientY = event.clientY || (event.changedTouches && event.changedTouches[0]?.clientY);
      
      if (clientX === undefined || clientY === undefined) return;
      
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      // Устанавливаем позицию и направление луча из камеры
      raycaster.setFromCamera(mouse, camera);

      // Получаем все пересечения с рекурсивным поиском
      const intersects = raycaster.intersectObjects(scene.children, true);

      // Находим первый кликабельный объект
      for (const intersect of intersects) {
        const object = intersect.object;
        
        // Проверяем, является ли объект мешем с возможностью клика
        if (object.isMesh && object.userData.isClickable) {
          const partName = object.userData.partName || object.name || "Unknown Part";
          if (onPartClick) {
            onPartClick(partName, intersect);
          }
          break;
        }
      }
    };

    const handlePointerMove = (event) => {
      // Нормализуем координаты мыши
      const mouse = new THREE.Vector2();
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        const object = intersects[0].object;
        if (object.isMesh && object.userData.isClickable) {
          setHovered(object);
        } else {
          setHovered(null);
        }
      } else {
        setHovered(null);
      }
    };

    // Добавляем обработчики событий на canvas (поддержка мыши и touch)
    gl.domElement.addEventListener("click", handleClick);
    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("touchend", handleClick);

    return () => {
      gl.domElement.removeEventListener("click", handleClick);
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("touchend", handleClick);
    };
  }, [camera, gl, raycaster, scene, onPartClick]);

  return null;
}

// Компонент для отображения сцены
function Scene({ modelUrl, onPartClick, selectedPart }) {
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
          <Model url={modelUrl} onPartClick={onPartClick} selectedPart={selectedPart} />
        </Suspense>
      )}

      {/* Геометрическая фигура по умолчанию, если модель не загружена */}
      {!modelUrl && (
        <mesh>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#3390ec" />
        </mesh>
      )}

      {/* Обработчик кликов */}
      {modelUrl && (
        <ClickHandler onPartClick={onPartClick} />
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

function ModelViewer({ modelUrl, onPartClick, selectedPart }) {
  return (
    <div className="model-viewer-container">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene modelUrl={modelUrl} onPartClick={onPartClick} selectedPart={selectedPart} />
      </Canvas>
    </div>
  );
}

export default ModelViewer;

