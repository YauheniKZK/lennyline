import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import "./Game.css";
import packageJson from "../../package.json";

// Версия приложения
const APP_VERSION = packageJson.version;

// Константы игры
const NEEDLE_WIDTH = 160; // Длина иголки (горизонтальная)
const NEEDLE_HEIGHT = 4; // Ширина иголки (узкая)
const NEEDLE_SPEED = 250; // Скорость движения иголки влево/вправо (уменьшена для точности)
const NEEDLE_PRECISE_SPEED = 120; // Скорость для точных движений при коротких нажатиях
const NEEDLE_ACCELERATION = 1200; // Ускорение иголки (для плавного движения)
const NEEDLE_DECELERATION = 1000; // Замедление иголки (для точной остановки)
const NEEDLE_BOOST_MAX_MULTIPLIER = 3.0; // Максимальный коэффициент увеличения скорости
const NEEDLE_BOOST_TIME_TO_MAX = 1000; // Время (мс) для достижения максимального ускорения
const PRECISE_TAP_THRESHOLD = 150; // Порог времени (мс) для определения короткого нажатия (тапа)
const PRECISE_TAP_COOLDOWN = 50; // Время (мс) после тапа, в течение которого используется точная скорость
const WALL_SPEED = 200; // Скорость движения стен
const WALL_SPAWN_INTERVAL = 6000; // Интервал появления стен (мс)
const WALL_WIDTH = 500; // Ширина стены (узкая, вертикальная)
const GAP_SIZE = 6; // Размер зазора между стенами (маленький)
const WALL_MIN_HEIGHT = 100; // Минимальная высота части стены

// Класс игровой сцены Phaser
class NeedleGameScene extends Phaser.Scene {
  constructor() {
    super({ key: "NeedleGameScene" });
    this.needle = null;
    this.walls = null;
    this.scoreText = null;
    this.scoreValue = 0;
    this.wallSpawnTimer = 0;
    this.isGameActive = true;
    this.onScoreUpdate = null;
    this.onGameOver = null;
    this.cursors = null;
    this.buttonUpPressed = false;
    this.buttonDownPressed = false;
    this.buttonUpHoldTime = 0; // Время удержания кнопки вверх (мс)
    this.buttonDownHoldTime = 0; // Время удержания кнопки вниз (мс)
    this.nextGapY = null; // Позиция зазора следующей стены
    this.gapHintGraphics = null; // Графические элементы подсказок
    this.wallIdCounter = 0; // Счетчик для уникальных ID стен
    this.passedWalls = new Set(); // Множество пройденных стен
    this.lastUpPressTime = 0; // Время последнего нажатия вверх
    this.lastDownPressTime = 0; // Время последнего нажатия вниз
    this.lastUpReleaseTime = 0; // Время последнего отпускания вверх
    this.lastDownReleaseTime = 0; // Время последнего отпускания вниз
    this.preciseModeTimer = 0; // Таймер для режима точного управления
  }

  init(data) {
    if (data) {
      this.onScoreUpdate = data.onScoreUpdate;
      this.onGameOver = data.onGameOver;
    }
  }

  preload() {
    // Создаем текстуру иголки (горизонтальная)
    const graphics = this.add.graphics();

    // Иголка - длинный тонкий прямоугольник с острием на правом конце
    graphics.fillStyle(0x333333); // Темно-серый цвет

    // Тело иголки (длинный тонкий прямоугольник - горизонтальный)
    const tipWidth = 8; // Ширина острия
    const bodyWidth = NEEDLE_WIDTH - tipWidth; // Ширина тела (минус острие)
    graphics.fillRect(0, 0, bodyWidth, NEEDLE_HEIGHT);

    // Острие иголки (треугольник на правом конце)
    const tipX = NEEDLE_WIDTH - tipWidth; // Позиция начала острия
    graphics.fillTriangle(
      NEEDLE_WIDTH,
      NEEDLE_HEIGHT / 2, // Вершина острия (справа, центр)
      tipX,
      NEEDLE_HEIGHT, // Левый нижний угол острия
      tipX,
      0 // Левый верхний угол острия
    );

    graphics.generateTexture("needle", NEEDLE_WIDTH, NEEDLE_HEIGHT);
    graphics.destroy();

    // Текстура для стены (вертикальная - узкая и высокая)
    this.add
      .graphics()
      .fillStyle(0xff6b6b)
      .fillRect(0, 0, WALL_WIDTH, 100)
      .generateTexture("wall", WALL_WIDTH, 100);
  }

  create() {
    const { width, height } = this.scale;
    const centerY = height / 2;

    // Создаем иголку в центре экрана (горизонтально)
    this.needle = this.physics.add.sprite(width * 0.2, centerY, "needle");
    this.needle.setCollideWorldBounds(true);
    this.needle.body.setSize(NEEDLE_WIDTH, NEEDLE_HEIGHT);
    this.needle.body.setAllowGravity(false);

    // Группа для стен
    this.walls = this.physics.add.group();

    // Физика столкновений
    this.physics.add.overlap(this.needle, this.walls, this.hitWall, null, this);

    // Управление
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on("keydown-SPACE", () => this.moveUp(), this);
    this.input.on("pointerdown", () => this.moveUp(), this);

    // Отслеживание нажатий клавиш для определения коротких нажатий
    this.wasUpPressed = false;
    this.wasDownPressed = false;

    // Текст счета
    this.scoreText = this.add.text(20, 20, "Пройдено стен: 0", {
      fontSize: "24px",
      fill: "#000",
      fontFamily: "Arial",
    });

    // Инструкция
    this.instructionText = this.add.text(
      width / 2,
      height - 50,
      "Стрелки вверх/вниз или клик/пробел",
      {
        fontSize: "18px",
        fill: "#666",
        fontFamily: "Arial",
      }
    );
    this.instructionText.setOrigin(0.5, 0.5);

    // Создаем графические элементы для подсказок зазора
    this.gapHintGraphics = this.add.graphics();

    // Генерируем первый зазор
    this.generateNextGap(height);
  }

  moveUp(time) {
    if (!this.isGameActive) return;
    const currentTime = time || this.time.now;

    // Определяем, было ли это короткое нажатие (тап)
    const timeSinceRelease = currentTime - this.lastUpReleaseTime;
    const wasQuickTap =
      timeSinceRelease < PRECISE_TAP_THRESHOLD && this.lastUpReleaseTime > 0;

    if (wasQuickTap) {
      // Включаем режим точного управления после короткого нажатия
      this.preciseModeTimer = PRECISE_TAP_COOLDOWN;
    }

    this.lastUpPressTime = currentTime;
    this.buttonUpPressed = true;
  }

  moveDown(time) {
    if (!this.isGameActive) return;
    const currentTime = time || this.time.now;

    // Определяем, было ли это короткое нажатие (тап)
    const timeSinceRelease = currentTime - this.lastDownReleaseTime;
    const wasQuickTap =
      timeSinceRelease < PRECISE_TAP_THRESHOLD && this.lastDownReleaseTime > 0;

    if (wasQuickTap) {
      // Включаем режим точного управления после короткого нажатия
      this.preciseModeTimer = PRECISE_TAP_COOLDOWN;
    }

    this.lastDownPressTime = currentTime;
    this.buttonDownPressed = true;
  }

  stopMoving() {
    if (!this.isGameActive) return;
    this.buttonUpPressed = false;
    this.buttonDownPressed = false;
  }

  stopMovingUp(time) {
    if (!this.isGameActive) return;
    const currentTime = time || this.time.now;
    const holdDuration = currentTime - this.lastUpPressTime;

    // Если нажатие было коротким, сохраняем время отпускания
    if (holdDuration < PRECISE_TAP_THRESHOLD) {
      this.lastUpReleaseTime = currentTime;
    } else {
      this.lastUpReleaseTime = 0; // Сбрасываем, если было длинное нажатие
    }

    this.buttonUpPressed = false;
    this.buttonUpHoldTime = 0; // Сбрасываем время удержания
  }

  stopMovingDown(time) {
    if (!this.isGameActive) return;
    const currentTime = time || this.time.now;
    const holdDuration = currentTime - this.lastDownPressTime;

    // Если нажатие было коротким, сохраняем время отпускания
    if (holdDuration < PRECISE_TAP_THRESHOLD) {
      this.lastDownReleaseTime = currentTime;
    } else {
      this.lastDownReleaseTime = 0; // Сбрасываем, если было длинное нажатие
    }

    this.buttonDownPressed = false;
    this.buttonDownHoldTime = 0; // Сбрасываем время удержания
  }

  hitWall() {
    if (!this.isGameActive) return;

    console.log("Hit wall! Game over!");
    this.isGameActive = false;
    if (this.onGameOver) {
      this.onGameOver();
    }
    this.physics.pause();
  }

  // Генерация следующего зазора
  generateNextGap(height) {
    const minGapY = WALL_MIN_HEIGHT;
    const maxGapY = height - WALL_MIN_HEIGHT - GAP_SIZE;
    this.nextGapY = minGapY + Math.random() * (maxGapY - minGapY);
  }

  // Создание вертикальной стены с горизонтальным зазором
  createWall(x, height) {
    // Используем предварительно сгенерированную позицию зазора
    const gapY = this.nextGapY;

    // Генерируем следующий зазор для следующей стены
    this.generateNextGap(height);

    // Уникальный ID для этой стены
    const wallId = this.wallIdCounter++;
    const wallX = x; // Сохраняем начальную позицию X для отслеживания

    // Верхняя часть стены (вертикальная)
    const topWallHeight = gapY;
    if (topWallHeight > 20) {
      const topWall = this.walls.create(x, 0, "wall");
      topWall.setOrigin(0, 0);
      topWall.setDisplaySize(WALL_WIDTH, topWallHeight);
      topWall.setVelocityX(-WALL_SPEED);
      topWall.body.allowGravity = false;
      topWall.body.setImmovable(true);
      topWall.setCollideWorldBounds(false);
      topWall.wallId = wallId; // Присваиваем ID
      topWall.wallX = wallX; // Сохраняем позицию стены
    }

    // Нижняя часть стены (вертикальная)
    const gapBottom = gapY + GAP_SIZE;
    const bottomWallHeight = height - gapBottom;
    if (bottomWallHeight > 20) {
      const bottomWall = this.walls.create(x, gapBottom, "wall");
      bottomWall.setOrigin(0, 0);
      bottomWall.setDisplaySize(WALL_WIDTH, bottomWallHeight);
      bottomWall.setVelocityX(-WALL_SPEED);
      bottomWall.body.allowGravity = false;
      bottomWall.body.setImmovable(true);
      bottomWall.setCollideWorldBounds(false);
      bottomWall.wallId = wallId; // Присваиваем тот же ID
      bottomWall.wallX = wallX; // Сохраняем позицию стены
    }
  }

  // Отображение подсказок зазора
  updateGapHints(width) {
    if (!this.gapHintGraphics || this.nextGapY === null) return;

    this.gapHintGraphics.clear();

    // Позиция для отображения подсказок (правая часть экрана)
    const hintX = width * 0.85;
    const hintWidth = 30;
    const gapTop = this.nextGapY;
    const gapBottom = this.nextGapY + GAP_SIZE;

    // Верхняя граница зазора - пунктирная линия
    this.gapHintGraphics.lineStyle(2, 0x4caf50, 0.7);
    this.gapHintGraphics.beginPath();
    for (let x = hintX; x < hintX + hintWidth; x += 4) {
      this.gapHintGraphics.moveTo(x, gapTop - 10);
      this.gapHintGraphics.lineTo(
        Math.min(x + 2, hintX + hintWidth),
        gapTop - 10
      );
    }
    this.gapHintGraphics.strokePath();

    // Нижняя граница зазора - пунктирная линия
    this.gapHintGraphics.beginPath();
    for (let x = hintX; x < hintX + hintWidth; x += 4) {
      this.gapHintGraphics.moveTo(x, gapBottom + 10);
      this.gapHintGraphics.lineTo(
        Math.min(x + 2, hintX + hintWidth),
        gapBottom + 10
      );
    }
    this.gapHintGraphics.strokePath();

    // Зона зазора - полупрозрачный прямоугольник
    this.gapHintGraphics.fillStyle(0x4caf50, 0.3);
    this.gapHintGraphics.fillRect(hintX, gapTop - 10, hintWidth, GAP_SIZE + 20);

    // Стрелки указывающие на зазор
    const arrowY = gapTop + GAP_SIZE / 2;
    this.gapHintGraphics.lineStyle(2, 0x4caf50, 0.9);
    // Левая стрелка
    this.gapHintGraphics.beginPath();
    this.gapHintGraphics.moveTo(hintX - 15, arrowY);
    this.gapHintGraphics.lineTo(hintX - 5, arrowY);
    this.gapHintGraphics.lineTo(hintX - 8, arrowY - 3);
    this.gapHintGraphics.moveTo(hintX - 5, arrowY);
    this.gapHintGraphics.lineTo(hintX - 8, arrowY + 3);
    this.gapHintGraphics.strokePath();

    // Правая стрелка
    this.gapHintGraphics.beginPath();
    this.gapHintGraphics.moveTo(hintX + hintWidth + 5, arrowY);
    this.gapHintGraphics.lineTo(hintX + hintWidth + 15, arrowY);
    this.gapHintGraphics.lineTo(hintX + hintWidth + 12, arrowY - 3);
    this.gapHintGraphics.moveTo(hintX + hintWidth + 15, arrowY);
    this.gapHintGraphics.lineTo(hintX + hintWidth + 12, arrowY + 3);
    this.gapHintGraphics.strokePath();
  }

  // Сброс состояния
  resetState() {
    this.scoreValue = 0;
    this.wallSpawnTimer = 0;
    this.isGameActive = true;
    this.buttonUpPressed = false;
    this.buttonDownPressed = false;
    this.buttonUpHoldTime = 0;
    this.buttonDownHoldTime = 0;
    this.wallIdCounter = 0;
    this.passedWalls.clear();
    this.lastUpPressTime = 0;
    this.lastDownPressTime = 0;
    this.lastUpReleaseTime = 0;
    this.lastDownReleaseTime = 0;
    this.preciseModeTimer = 0;
    this.wasUpPressed = false;
    this.wasDownPressed = false;
    if (this.gapHintGraphics) {
      this.gapHintGraphics.clear();
    }
  }

  update(time, delta) {
    if (!this.isGameActive) return;

    const { width, height } = this.scale;

    // Иголка неподвижна по горизонтали (стены движутся навстречу)
    this.needle.setVelocityX(0);

    // Обновляем таймер режима точного управления
    if (this.preciseModeTimer > 0) {
      this.preciseModeTimer -= delta;
      if (this.preciseModeTimer < 0) {
        this.preciseModeTimer = 0;
      }
    }

    // Управление иголкой вверх/вниз с плавным ускорением для точности
    const currentVelocityY = this.needle.body.velocity.y;
    let targetVelocity = 0;

    // Обновляем время удержания кнопок и рассчитываем множитель ускорения
    if (this.buttonUpPressed) {
      this.buttonUpHoldTime += delta; // Увеличиваем время удержания
    } else {
      this.buttonUpHoldTime = 0; // Сбрасываем, если кнопка не нажата
    }

    if (this.buttonDownPressed) {
      this.buttonDownHoldTime += delta; // Увеличиваем время удержания
    } else {
      this.buttonDownHoldTime = 0; // Сбрасываем, если кнопка не нажата
    }

    // Определяем, находимся ли в режиме точного управления
    const isPreciseMode =
      this.preciseModeTimer > 0 ||
      (this.buttonUpPressed && this.buttonUpHoldTime < PRECISE_TAP_THRESHOLD) ||
      (this.buttonDownPressed &&
        this.buttonDownHoldTime < PRECISE_TAP_THRESHOLD);

    // Базовая скорость зависит от режима
    const baseSpeed = isPreciseMode ? NEEDLE_PRECISE_SPEED : NEEDLE_SPEED;

    // Рассчитываем текущий множитель ускорения на основе времени удержания
    const getBoostMultiplier = (holdTime) => {
      if (holdTime <= 0) return 1;
      // В режиме точного управления не используем ускорение
      if (isPreciseMode) return 1;
      // Прогрессивное увеличение от 1 до NEEDLE_BOOST_MAX_MULTIPLIER
      const progress = Math.min(holdTime / NEEDLE_BOOST_TIME_TO_MAX, 1);
      return 1 + (NEEDLE_BOOST_MAX_MULTIPLIER - 1) * progress;
    };

    // Отслеживание коротких нажатий на клавиатуре
    if (this.cursors.up.isDown && !this.wasUpPressed) {
      // Только что нажали вверх
      if (
        this.lastUpReleaseTime > 0 &&
        time - this.lastUpReleaseTime < PRECISE_TAP_THRESHOLD
      ) {
        // Быстрое повторное нажатие - режим точного управления
        this.preciseModeTimer = PRECISE_TAP_COOLDOWN;
      }
      this.lastUpPressTime = time;
      this.wasUpPressed = true;
    } else if (!this.cursors.up.isDown && this.wasUpPressed) {
      // Только что отпустили вверх
      const holdDuration = time - this.lastUpPressTime;
      if (holdDuration < PRECISE_TAP_THRESHOLD && this.lastUpPressTime > 0) {
        this.lastUpReleaseTime = time;
      } else {
        this.lastUpReleaseTime = 0;
      }
      this.wasUpPressed = false;
    }

    if (this.cursors.down.isDown && !this.wasDownPressed) {
      // Только что нажали вниз
      if (
        this.lastDownReleaseTime > 0 &&
        time - this.lastDownReleaseTime < PRECISE_TAP_THRESHOLD
      ) {
        // Быстрое повторное нажатие - режим точного управления
        this.preciseModeTimer = PRECISE_TAP_COOLDOWN;
      }
      this.lastDownPressTime = time;
      this.wasDownPressed = true;
    } else if (!this.cursors.down.isDown && this.wasDownPressed) {
      // Только что отпустили вниз
      const holdDuration = time - this.lastDownPressTime;
      if (holdDuration < PRECISE_TAP_THRESHOLD && this.lastDownPressTime > 0) {
        this.lastDownReleaseTime = time;
      } else {
        this.lastDownReleaseTime = 0;
      }
      this.wasDownPressed = false;
    }

    if (this.cursors.up.isDown || this.buttonUpPressed) {
      // Применяем прогрессивный коэффициент ускорения для кнопки на экране
      const speedMultiplier = this.buttonUpPressed
        ? getBoostMultiplier(this.buttonUpHoldTime)
        : 1;
      targetVelocity = -baseSpeed * speedMultiplier;
    } else if (this.cursors.down.isDown || this.buttonDownPressed) {
      // Применяем прогрессивный коэффициент ускорения для кнопки на экране
      const speedMultiplier = this.buttonDownPressed
        ? getBoostMultiplier(this.buttonDownHoldTime)
        : 1;
      targetVelocity = baseSpeed * speedMultiplier;
    }

    // Плавное ускорение/замедление к целевой скорости
    if (targetVelocity !== 0) {
      // Ускоряемся к целевой скорости
      const acceleration = NEEDLE_ACCELERATION * (delta / 1000);
      let newVelocityY = currentVelocityY;

      if (targetVelocity < 0) {
        // Движение вверх
        newVelocityY = Math.max(
          targetVelocity,
          currentVelocityY - acceleration
        );
      } else {
        // Движение вниз
        newVelocityY = Math.min(
          targetVelocity,
          currentVelocityY + acceleration
        );
      }

      this.needle.setVelocityY(newVelocityY);
    } else {
      // Плавное замедление при отпускании клавиш
      if (Math.abs(currentVelocityY) > 0.1) {
        const deceleration = NEEDLE_DECELERATION * (delta / 1000);
        let newVelocityY = currentVelocityY;

        if (currentVelocityY > 0) {
          newVelocityY = Math.max(0, currentVelocityY - deceleration);
        } else {
          newVelocityY = Math.min(0, currentVelocityY + deceleration);
        }

        this.needle.setVelocityY(newVelocityY);
      } else {
        // Останавливаем полностью при очень малой скорости
        this.needle.setVelocityY(0);
      }
    }

    // Ограничиваем движение иголки границами экрана (вертикально)
    if (this.needle.y < NEEDLE_HEIGHT / 2) {
      this.needle.y = NEEDLE_HEIGHT / 2;
      this.needle.setVelocityY(0);
    } else if (this.needle.y > height - NEEDLE_HEIGHT / 2) {
      this.needle.y = height - NEEDLE_HEIGHT / 2;
      this.needle.setVelocityY(0);
    }

    // Обновление подсказок зазора
    this.updateGapHints(width);

    // Создание стен (вертикальные стены с горизонтальными зазорами)
    this.wallSpawnTimer += delta;
    if (this.wallSpawnTimer >= WALL_SPAWN_INTERVAL) {
      this.createWall(width, height);
      this.wallSpawnTimer = 0;
    }

    // Удаление стен за экраном и подсчет пройденных стен
    this.walls.children.entries.forEach((wall) => {
      // Проверяем, прошла ли иголка через стену полностью
      if (
        wall.wallId !== undefined &&
        wall.x + wall.displayWidth < this.needle.x &&
        !this.passedWalls.has(wall.wallId)
      ) {
        // Стена пройдена
        this.passedWalls.add(wall.wallId);
        this.scoreValue++;
        if (this.onScoreUpdate) {
          this.onScoreUpdate(this.scoreValue);
        }
        this.scoreText.setText(`Пройдено стен: ${this.scoreValue}`);
      }

      // Удаляем стену, если она полностью вышла за экран
      if (wall.x + wall.displayWidth < -50) {
        wall.destroy();
      }
    });
  }
}

function GameNeedle() {
  const gameRef = useRef(null);
  const phaserGameRef = useRef(null);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isUpPressed, setIsUpPressed] = useState(false);
  const [isDownPressed, setIsDownPressed] = useState(false);

  // Инициализация Phaser игры
  useEffect(() => {
    if (!isGameStarted || !gameRef.current) return;

    const scaleFactor = 1.4;
    const gameWidth = gameRef.current.clientWidth * scaleFactor;
    const gameHeight = gameRef.current.clientHeight * scaleFactor;

    const config = {
      type: Phaser.AUTO,
      width: gameWidth,
      height: gameHeight,
      parent: gameRef.current,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
      scene: [NeedleGameScene],
      backgroundColor: "#f0f0f0",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    phaserGameRef.current = new Phaser.Game(config);

    // Установка колбэков
    const setupCallbacks = () => {
      const scene = phaserGameRef.current?.scene.getScene("NeedleGameScene");
      if (scene) {
        scene.onScoreUpdate = setScore;
        scene.onGameOver = () => {
          console.log("Game Over callback called");
          setIsGameOver(true);
        };
        // Сохраняем ссылку на сцену для управления из кнопок
        scene.moveUpButton = () => scene.moveUp();
        scene.moveDownButton = () => scene.moveDown();
        scene.stopMovingUpButton = () => scene.stopMovingUp();
        scene.stopMovingDownButton = () => scene.stopMovingDown();
      }
    };

    setTimeout(() => {
      setupCallbacks();
    }, 100);

    const scene = phaserGameRef.current.scene.getScene("NeedleGameScene");
    if (scene) {
      scene.events.once("create", () => {
        setupCallbacks();
      });
    }

    // Обработка изменения размера окна
    const handleResize = () => {
      if (phaserGameRef.current && gameRef.current) {
        phaserGameRef.current.scale.resize(
          gameRef.current.clientWidth,
          gameRef.current.clientHeight
        );
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, [isGameStarted]);

  const handleStart = () => {
    setIsGameStarted(true);
    setIsGameOver(false);
    setScore(0);
  };

  const handleRestart = () => {
    setIsGameOver(false);
    setScore(0);

    if (phaserGameRef.current && isGameStarted) {
      const scene = phaserGameRef.current.scene.getScene("NeedleGameScene");
      if (scene) {
        scene.resetState();
        scene.scene.restart();

        setTimeout(() => {
          const newScene =
            phaserGameRef.current?.scene.getScene("NeedleGameScene");
          if (newScene) {
            newScene.onScoreUpdate = setScore;
            newScene.onGameOver = () => setIsGameOver(true);
            if (newScene.physics) {
              newScene.physics.resume();
            }
          }
        }, 100);
      } else {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
        setIsGameStarted(false);
        setTimeout(() => {
          setIsGameStarted(true);
        }, 100);
      }
    } else {
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
      setIsGameStarted(false);
      setTimeout(() => {
        setIsGameStarted(true);
      }, 100);
    }
  };

  const handleBack = () => {
    if (phaserGameRef.current) {
      phaserGameRef.current.destroy(true);
      phaserGameRef.current = null;
    }
    setIsGameStarted(false);
    setIsGameOver(false);
    setScore(0);
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-title-section">
          <h2 className="game-title">Иголка</h2>
          <span className="game-version">v{APP_VERSION}</span>
        </div>
      </div>

      <div className="game-area">
        {!isGameStarted ? (
          <div className="game-menu">
            <div className="game-menu-content">
              <h2 className="game-menu-title">Иголка</h2>
              <p style={{ color: "#666", marginBottom: "20px" }}>
                Управляйте иголкой вверх/вниз и пролетайте через зазоры в
                стенах! Иголка автоматически движется вперед. Используйте
                стрелки вверх/вниз или кнопки.
              </p>

              <button className="game-menu-button" onClick={handleStart}>
                Старт
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{ position: "relative", width: "100%", height: "100%" }}
            onContextMenu={(e) => {
              e.preventDefault();
              return false;
            }}
          >
            <div
              ref={gameRef}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                position: "relative",
                zIndex: 1,
              }}
            />
            {/* Кнопки управления */}
            {!isGameOver && (
              <div
                style={{
                  position: "absolute",
                  right: "20px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                  zIndex: 1000,
                }}
              >
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsUpPressed(true);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.moveUpButton) {
                      scene.moveUpButton();
                    }
                  }}
                  onMouseUp={() => {
                    setIsUpPressed(false);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.stopMovingUpButton) {
                      scene.stopMovingUpButton();
                    }
                  }}
                  onMouseLeave={() => {
                    setIsUpPressed(false);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.stopMovingUpButton) {
                      scene.stopMovingUpButton();
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    return false;
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setIsUpPressed(true);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.moveUpButton) {
                      scene.moveUpButton();
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    setIsUpPressed(false);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.stopMovingUpButton) {
                      scene.stopMovingUpButton();
                    }
                  }}
                  onTouchCancel={(e) => {
                    e.preventDefault();
                    setIsUpPressed(false);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.stopMovingUpButton) {
                      scene.stopMovingUpButton();
                    }
                  }}
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    backgroundColor: isUpPressed ? "#4CAF50" : "#28a745",
                    border: "none",
                    color: "white",
                    fontSize: "24px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                    transition: "background-color 0.1s",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    MozUserSelect: "none",
                    msUserSelect: "none",
                    outline: "none",
                    WebkitTapHighlightColor: "transparent",
                    WebkitTouchCallout: "none",
                    touchAction: "manipulation",
                    pointerEvents: "auto",
                    WebkitAppearance: "none",
                    appearance: "none",
                  }}
                  onFocus={(e) => e.target.blur()}
                >
                  <span
                    style={{
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      MozUserSelect: "none",
                      msUserSelect: "none",
                      WebkitTouchCallout: "none",
                      pointerEvents: "none",
                    }}
                  >
                    ↑
                  </span>
                </button>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsDownPressed(true);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.moveDownButton) {
                      scene.moveDownButton();
                    }
                  }}
                  onMouseUp={() => {
                    setIsDownPressed(false);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.stopMovingDownButton) {
                      scene.stopMovingDownButton();
                    }
                  }}
                  onMouseLeave={() => {
                    setIsDownPressed(false);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.stopMovingDownButton) {
                      scene.stopMovingDownButton();
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    return false;
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setIsDownPressed(true);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.moveDownButton) {
                      scene.moveDownButton();
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    setIsDownPressed(false);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.stopMovingDownButton) {
                      scene.stopMovingDownButton();
                    }
                  }}
                  onTouchCancel={(e) => {
                    e.preventDefault();
                    setIsDownPressed(false);
                    const scene =
                      phaserGameRef.current?.scene.getScene("NeedleGameScene");
                    if (scene && scene.stopMovingDownButton) {
                      scene.stopMovingDownButton();
                    }
                  }}
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    backgroundColor: isDownPressed ? "#4CAF50" : "#28a745",
                    border: "none",
                    color: "white",
                    fontSize: "24px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                    transition: "background-color 0.1s",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    MozUserSelect: "none",
                    msUserSelect: "none",
                    outline: "none",
                    WebkitTapHighlightColor: "transparent",
                    WebkitTouchCallout: "none",
                    touchAction: "manipulation",
                    pointerEvents: "auto",
                    WebkitAppearance: "none",
                    appearance: "none",
                  }}
                  onFocus={(e) => e.target.blur()}
                >
                  <span
                    style={{
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      MozUserSelect: "none",
                      msUserSelect: "none",
                      WebkitTouchCallout: "none",
                      pointerEvents: "none",
                    }}
                  >
                    ↓
                  </span>
                </button>
              </div>
            )}
            {isGameOver ? (
              <div className="game-overlay" style={{ display: "flex" }}>
                <div className="game-overlay-content">
                  <h2>Игра окончена!</h2>
                  <p>Пройдено стен: {score}</p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      marginTop: "20px",
                      width: "100%",
                    }}
                  >
                    <button
                      className="game-menu-button"
                      onClick={handleRestart}
                      style={{
                        backgroundColor: "#28a745",
                        fontSize: "1.1rem",
                        padding: "0.9rem 1.5rem",
                        cursor: "pointer",
                      }}
                    >
                      Начать заново
                    </button>
                    <button
                      className="game-menu-button"
                      onClick={handleBack}
                      style={{
                        backgroundColor: "#6c757d",
                        cursor: "pointer",
                      }}
                    >
                      Меню
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default GameNeedle;
