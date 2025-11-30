import { useEffect, useRef, useState, useCallback } from "react";
import Phaser from "phaser";
import "./Game.css";
import packageJson from "../../package.json";
import MapGenerator from "./MapGenerator";

// Версия приложения
const APP_VERSION = packageJson.version;

// Константы игры
const GRAVITY = 800; // Уменьшена гравитация для более высоких прыжков
const JUMP_STRENGTH = -400; // Начальная скорость прыжка (высота подъема)
const JUMP_ACCELERATION = -2500; // Ускорение прыжка (скорость набора высоты) - чем больше абсолютное значение, тем быстрее подъем
const JUMP_DURATION = 250; // Длительность ускорения прыжка в миллисекундах (чем больше, тем дольше ускорение)
const OBSTACLE_SPEED = 400;
const PLATFORM_SPAWN_INTERVAL = 3000;
const WALL_SPAWN_INTERVAL = 6000; // Интервал появления вертикальных стен
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const PLATFORM_WIDTH = 150;
const PLATFORM_HEIGHT = 15;
const PLATFORM_MIN_DISTANCE = 200; // Минимальное расстояние между платформами
const JUMP_FORWARD_SPEED = 150; // Скорость движения вперед при прыжке
const WALL_WIDTH = 400; // Ширина вертикальной стены (увеличена для новой логики)
const WALL_GAP_MIN = PLAYER_HEIGHT * 4; // Минимальный размер отверстия (два персонажа)
const WALL_GAP_MAX = PLAYER_HEIGHT * 6; // Максимальный размер отверстия (три персонажа)

// Флаг для новой логики взаимодействия со стенами
const NEW_WALL_LOGIC_ENABLED = true; // true - новая логика (нет проигрыша при соприкосновении), false - старая логика

// Класс игровой сцены Phaser
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.player = null;
    this.platforms = null;
    this.walls = null; // Группа для вертикальных стен
    this.ground = null;
    this.scoreText = null;
    this.scoreValue = 0;
    this.platformSpawnTimer = 0;
    this.wallSpawnTimer = 0; // Таймер для генерации стен
    this.isGameActive = true;
    this.onScoreUpdate = null;
    this.onGameOver = null;
    this.jumpCount = 0; // Счетчик прыжков для двойного прыжка
    this.maxJumps = 3; // Максимальное количество прыжков
    this.jumpAccelerationTimer = 0; // Таймер ускорения прыжка
    this.isJumpAccelerating = false; // Флаг активного ускорения прыжка
    this.isChargingJump = false; // Флаг зарядки первого прыжка
    this.jumpCharge = 0; // Накопленная сила прыжка (0-1)
    this.maxJumpChargeTime = 1000; // Максимальное время зарядки в миллисекундах
    this.chargeTimer = 0; // Таймер зарядки
    this.isFlipped = false; // Флаг переворота персонажа
    this.flipTimer = 0; // Таймер для возврата из перевернутого состояния
    this.boostTimer = 0; // Таймер ускорения при перевороте
    this.boostSpeed = 0; // Текущая скорость ускорения
    this.baseVelocityX = 0; // Базовая скорость по X без ускорения
    this.fixedVelocityY = null; // Фиксированная скорость по Y во время ускорения
    this.onFlipAction = null; // Колбэк для уведомления о перевороте
    this.debugLogTimer = 0; // Таймер для периодического логирования
    this.originalGravityY = null; // Сохраняем изначальную гравитацию персонажа
    this.originalPositionX = null; // Изначальная позиция персонажа по X
    this.returnToPositionTimer = 0; // Таймер задержки перед возвратом в исходную позицию
    this.returnDelay = 1000; // Задержка перед возвратом (мс) - 1 секунда
    this.returnSpeed = 100; // Скорость возврата (пикселей в секунду)
    this.useSavedMap = false; // Флаг использования сохраненной карты
    this.jumpForwardDeceleration = 300; // Замедление движения вперед после прыжка (пикселей в секунду в секунду)
    this.mapData = null; // Данные сохраненной карты
    this.mapObstaclesCreated = false; // Флаг создания препятствий из карты
    this.mapProgress = 0; // Прогресс прохождения карты (в пикселях)
    this.spawnedObstacles = new Set(); // Множество уже созданных препятствий из карты
  }

  init(data) {
    // Получаем колбэки из data
    if (data) {
      this.onScoreUpdate = data.onScoreUpdate;
      this.onGameOver = data.onGameOver;
    }
  }

  preload() {
    // Создаем простые цветные прямоугольники для объектов
    this.add
      .graphics()
      .fillStyle(0x3390ec)
      .fillRect(0, 0, PLAYER_WIDTH, PLAYER_HEIGHT)
      .generateTexture("player", PLAYER_WIDTH, PLAYER_HEIGHT);

    this.add
      .graphics()
      .fillStyle(0x4a4a4a)
      .fillRect(0, 0, PLATFORM_WIDTH, PLATFORM_HEIGHT)
      .generateTexture("platform", PLATFORM_WIDTH, PLATFORM_HEIGHT);

    // Текстура для вертикальной стены
    this.add
      .graphics()
      .fillStyle(0xff6b6b)
      .fillRect(0, 0, WALL_WIDTH, 100) // Высота будет динамической
      .generateTexture("wall", WALL_WIDTH, 100);
  }

  create() {
    const { width, height } = this.scale;
    const groundY = height * 0.6;

    // Создаем землю
    this.ground = this.add.rectangle(
      0,
      groundY,
      width * 2,
      height - groundY,
      0x4a4a4a
    );
    this.ground.setOrigin(0, 0);
    this.physics.add.existing(this.ground, true);

    // Создаем персонажа
    const initialX = width * 0.2; // Изначальная позиция по X (20% от ширины)
    this.player = this.physics.add.sprite(
      initialX,
      groundY - PLAYER_HEIGHT / 2,
      "player"
    );
    this.player.setCollideWorldBounds(false);
    this.player.body.setSize(PLAYER_WIDTH, PLAYER_HEIGHT);
    // Сохраняем изначальную позицию по X для возврата
    this.originalPositionX = initialX;
    // Настраиваем физику персонажа для скольжения по препятствиям
    this.player.body.setFriction(0, 0); // Убираем трение для скольжения
    this.player.body.setBounce(0, 0); // Убираем отскок
    // Убеждаемся, что гравитация включена, но НЕ устанавливаем её явно
    // Позволяем Phaser использовать гравитацию из конфигурации мира
    this.player.body.setAllowGravity(true);
    // НЕ устанавливаем гравитацию явно - используем ту, что Phaser установил из конфигурации
    // Сохраняем изначальную гравитацию персонажа (из конфигурации мира)
    // Гравитация тела будет установлена Phaser'ом автоматически из конфигурации мира
    const worldGravity = this.physics.world.gravity.y;
    const bodyGravity = this.player.body.gravity.y;
    // Сохраняем гравитацию мира (она должна применяться к телу автоматически)
    // Если гравитация тела уже установлена и не 0, используем её, иначе используем гравитацию мира
    this.originalGravityY = bodyGravity !== 0 ? bodyGravity : (worldGravity !== 0 ? worldGravity : GRAVITY);
    console.log("[CREATE] Сохраняем изначальную гравитацию персонажа:", {
      allowGravity: this.player.body.allowGravity,
      bodyGravityY: bodyGravity,
      worldGravityY: worldGravity,
      originalGravityY: this.originalGravityY,
      note: "Гравитация тела будет установлена Phaser автоматически из конфигурации мира",
    });

    // Группы для платформ
    this.platforms = this.physics.add.group();
    this.walls = this.physics.add.group(); // Группа для вертикальных стен

    // Физика столкновений
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.platforms);
    // Столкновение со стенами
    if (NEW_WALL_LOGIC_ENABLED) {
      // Новая логика: физическое взаимодействие со стенами (можно упираться, бегать по ним)
      // но без проигрыша
      this.physics.add.collider(this.player, this.walls);
    } else {
      // Старая логика: при соприкосновении со стенами - проигрыш
      this.physics.add.overlap(
        this.player,
        this.walls,
        this.hitObstacle,
        null,
        this
      );
    }

    // Текст счета
    this.scoreText = this.add.text(20, 20, "Счет: 0", {
      fontSize: "24px",
      fill: "#000",
      fontFamily: "Arial",
    });

    // Визуальный индикатор силы прыжка
    const chargeBarWidth = 200;
    const chargeBarHeight = 20;
    const chargeBarX = width / 2 - chargeBarWidth / 2;
    const chargeBarY = height - 100;

    // Фон полосы прогресса
    this.chargeBarBg = this.add.rectangle(
      chargeBarX + chargeBarWidth / 2,
      chargeBarY,
      chargeBarWidth,
      chargeBarHeight,
      0x333333,
      0.7
    );
    this.chargeBarBg.setOrigin(0.5, 0.5);
    this.chargeBarBg.setVisible(true);

    // Полоса прогресса
    this.chargeBar = this.add.rectangle(
      chargeBarX,
      chargeBarY,
      0,
      chargeBarHeight,
      0x00ff00,
      0.9
    );
    this.chargeBar.setOrigin(0, 0.5);
    this.chargeBar.setVisible(true);

    // Текст с процентом
    this.chargeText = this.add.text(
      chargeBarX + chargeBarWidth / 2,
      chargeBarY,
      "0%",
      {
        fontSize: "18px",
        fill: "#ffffff",
        fontFamily: "Arial",
        fontStyle: "bold",
      }
    );
    this.chargeText.setOrigin(0.5, 0.5);
    this.chargeText.setVisible(true);

    // Управление
    this.input.keyboard.on("keydown-SPACE", this.startJump, this);
    this.input.keyboard.on("keyup-SPACE", this.endJump, this);
    this.input.on("pointerdown", this.startJump, this);
    this.input.on("pointerup", this.endJump, this);
    
    // Сохраняем ссылку на клавишу пробела для проверки состояния
    this.spaceKey = this.input.keyboard.addKey('SPACE');
    
    // Флаги для отслеживания состояния кнопок
    this.isPointerDown = false;
    this.wasPointerDown = false;
    this.isSpaceDown = false;
    this.wasSpaceDown = false;

    // Проверяем наличие сохраненной карты в localStorage
    try {
      const savedMap = localStorage.getItem("gameMap");
      if (savedMap) {
        this.mapData = JSON.parse(savedMap);
        this.useSavedMap = true;
        console.log("Загружена карта из localStorage:", this.mapData);
        // Создаем препятствия из сохраненной карты
        this.createMapObstacles();
      } else {
        console.log("Карта в localStorage не найдена, используется динамическая генерация");
        this.useSavedMap = false;
      }
    } catch (error) {
      console.error("Ошибка при загрузке карты из localStorage:", error);
      this.useSavedMap = false;
    }

    // Убеждаемся, что физика активна (на случай перезапуска)
    this.physics.resume();
  }

  // Создание препятствий из сохраненной карты (динамически по мере продвижения)
  createMapObstacles() {
    if (!this.mapData || !this.mapData.obstacles) return;

    const { width, height } = this.scale;
    const groundY = height * 0.6;

    // Создаем препятствия, которые должны появиться на экране
    // Препятствие должно появиться, когда его позиция в карте находится в пределах видимой области
    const spawnRange = width * 1.5; // Создаем препятствия заранее (на 1.5 ширины экрана вперед)
    
    this.mapData.obstacles.forEach((obstacle, index) => {
      const obstacleKey = `obstacle_${index}`;
      
      // Проверяем, не создано ли уже это препятствие
      if (this.spawnedObstacles.has(obstacleKey)) return;

      // Вычисляем, должна ли появиться препятствие
      // Препятствие появляется справа от экрана, когда его позиция в карте близка к текущему прогрессу
      const obstaclePositionInMap = obstacle.x;
      const distanceFromProgress = obstaclePositionInMap - this.mapProgress;
      
      // Если препятствие должно появиться (в пределах spawnRange справа от экрана)
      if (distanceFromProgress >= -width && distanceFromProgress <= spawnRange) {
        // Вычисляем позицию на экране: препятствие появляется справа от экрана
        // Если distanceFromProgress > 0, препятствие еще не достигло экрана, создаем его справа
        // Если distanceFromProgress <= 0, препятствие уже должно быть видно, но мы его создаем на правом краю
        const screenX = width + Math.max(0, distanceFromProgress);
        
        if (obstacle.type === "platform") {
          // Создаем платформу
          const platform = this.platforms.create(screenX, obstacle.y, "platform");
          platform.setVelocityX(-OBSTACLE_SPEED);
          platform.body.setSize(PLATFORM_WIDTH, PLATFORM_HEIGHT);
          platform.body.setGravityY(0);
          platform.body.setAllowGravity(false);
          platform.body.setImmovable(true);
          platform.setCollideWorldBounds(false);
          // Сохраняем оригинальную позицию в карте для отслеживания
          platform.mapX = obstacle.x;
          this.spawnedObstacles.add(obstacleKey);
        } else if (obstacle.type === "wall") {
          // Создаем стену
          this.createWallFromMap(screenX, height, groundY, obstacle.gapTop, obstacle.gapSize, obstacleKey);
        }
      }
    });
  }

  // Создание стены из данных карты
  createWallFromMap(x, height, groundY, gapTop, gapSize, obstacleKey) {
    // Верхняя часть стены
    const topWallHeight = gapTop;
    if (topWallHeight > 20) {
      const topWall = this.walls.create(x, 0, "wall");
      topWall.setOrigin(0, 0);
      topWall.setDisplaySize(WALL_WIDTH, topWallHeight);
      topWall.setVelocityX(-OBSTACLE_SPEED);
      topWall.body.allowGravity = false;
      topWall.body.setImmovable(true);
      topWall.setCollideWorldBounds(false);
    }

    // Нижняя часть стены
    const gapBottom = gapTop + gapSize;
    const bottomWallHeight = groundY - gapBottom;
    if (bottomWallHeight > 20) {
      const bottomWall = this.walls.create(x, gapBottom, "wall");
      bottomWall.setOrigin(0, 0);
      bottomWall.setDisplaySize(WALL_WIDTH, bottomWallHeight);
      bottomWall.setVelocityX(-OBSTACLE_SPEED);
      bottomWall.body.allowGravity = false;
      bottomWall.body.setImmovable(true);
      bottomWall.setCollideWorldBounds(false);
    }
    
    // Отмечаем препятствие как созданное
    if (obstacleKey) {
      this.spawnedObstacles.add(obstacleKey);
    }
  }

  // Начало прыжка (нажатие клавиши/клик)
  startJump() {
    if (!this.isGameActive) return;
    this.isPointerDown = true;
    this.isSpaceDown = true;
  }

  // Окончание прыжка (отпускание клавиши/клика)
  endJump() {
    if (!this.isGameActive) return;
    this.isPointerDown = false;
    this.isSpaceDown = false;
  }

  // Обновление визуального индикатора зарядки
  updateChargeIndicator() {
    if (!this.chargeBar || !this.chargeBarBg || !this.chargeText) return;

    const chargeBarWidth = 200;
    const chargeBarHeight = 20;
    const chargeBarX = this.scale.width / 2 - chargeBarWidth / 2;
    const chargeBarY = this.scale.height - 100;
    const centerX = this.scale.width / 2;

    // Обновляем позицию фона (центрируем)
    this.chargeBarBg.setPosition(centerX, chargeBarY);

    // Обновляем ширину полосы прогресса (от 0 до chargeBarWidth)
    const currentWidth = chargeBarWidth * this.jumpCharge;
    this.chargeBar.setSize(currentWidth, chargeBarHeight);
    this.chargeBar.setPosition(chargeBarX, chargeBarY);

    // Обновляем цвет полосы в зависимости от зарядки (зеленый -> желтый -> красный)
    let color = 0x00ff00; // Зеленый
    if (this.jumpCharge > 0.66) {
      color = 0xff0000; // Красный при высокой зарядке
    } else if (this.jumpCharge > 0.33) {
      color = 0xffff00; // Желтый при средней зарядке
    }
    this.chargeBar.setFillStyle(color, 0.9);

    // Обновляем позицию и текст с процентом
    this.chargeText.setPosition(centerX, chargeBarY);
    const percentage = Math.round(this.jumpCharge * 100);
    this.chargeText.setText(`${percentage}%`);
  }

  // Выполнение прыжка с заданной силой
  jump(jumpStrength = JUMP_STRENGTH) {
    if (!this.isGameActive) return;

    // Проверяем, стоит ли персонаж на земле или платформе
    const isOnGround =
      this.player.body.touching.down || this.player.body.onFloor();

    // Если на земле, сбрасываем счетчик прыжков
    if (isOnGround) {
      this.jumpCount = 0;
    }

    // Разрешаем прыжок, если еще не использовали все доступные прыжки
    if (this.jumpCount < this.maxJumps) {
      // Устанавливаем начальную скорость прыжка с учетом силы
      this.player.setVelocityY(jumpStrength);
      // Добавляем движение вперед при прыжке
      const currentVelocityX = this.player.body.velocity.x;
      this.player.setVelocityX(currentVelocityX + JUMP_FORWARD_SPEED);
      // Запускаем ускорение прыжка для контроля скорости набора высоты
      // Ускорение будет применяться в update() через прямое изменение скорости
      this.isJumpAccelerating = true;
      this.jumpAccelerationTimer = JUMP_DURATION;
      this.jumpCount++;
    }
  }

  // Переворот персонажа в горизонтальное положение
  flipPlayer() {
    if (!this.isGameActive || this.isFlipped) return; // Не переворачиваем, если уже перевернут

    this.isFlipped = true;
    this.flipTimer = 1000; // 1 секунда в миллисекундах

    // Переворачиваем персонажа: меняем размеры коллайдера и визуальное отображение
    // При перевороте персонаж становится горизонтальным: высота уменьшается, ширина увеличивается

    // Визуально поворачиваем спрайт на 90 градусов
    this.player.setAngle(90);

    // Меняем размеры коллайдера
    // После поворота на 90° по часовой стрелке коллайдер поворачивается вместе со спрайтом
    // В мировых координатах после поворота:
    // - мировая ширина (по оси X) = локальная высота
    // - мировая высота (по оси Y) = локальная ширина
    // Мы хотим получить мировую высоту 40px (меньше) и ширину 60px (больше)
    // Поэтому устанавливаем локальные размеры как height x width (60 x 40)
    // После поворота это даст мировую высоту 40px и ширину 60px

    // Используем setSize с центрированием
    this.player.body.setSize(PLAYER_HEIGHT, PLAYER_WIDTH, true);

    // Также обновляем через setBodySize если доступно (для более надежного обновления)
    if (this.player.body.setBodySize) {
      this.player.body.setBodySize(PLAYER_HEIGHT, PLAYER_WIDTH, true);
    }

    // Принудительно обновляем размеры через прямой доступ
    this.player.body.width = PLAYER_HEIGHT;
    this.player.body.height = PLAYER_WIDTH;

    // Обновляем размеры отображения для визуального соответствия
    this.player.setDisplaySize(PLAYER_WIDTH, PLAYER_HEIGHT);

    // Обновляем центр коллайдера
    this.player.body.updateCenter();

    // Принудительно обновляем физическое тело
    this.player.body.updateFromGameObject();

    // Отключаем ускорение прыжка при перевороте
    if (this.isJumpAccelerating) {
      this.isJumpAccelerating = false;
      this.jumpAccelerationTimer = 0;
      this.player.body.setAccelerationY(0);
    }

    // Добавляем ускорение вперед при перевороте (длится 1 секунду)
    const initialBoostSpeed = 300; // Начальная скорость ускорения вперед
    this.baseVelocityX = this.player.body.velocity.x; // Сохраняем базовую скорость по X
    this.boostSpeed = initialBoostSpeed;
    this.boostTimer = 1000; // 1 секунда в миллисекундах
    // Останавливаем движение по Y (скорость = 0)
    this.fixedVelocityY = 0; // Фиксируем скорость по Y на 0 (останавливаем движение вверх/вниз)
    // Полностью отключаем гравитацию на время ускорения
    console.log("[FLIP] Отключаем гравитацию и останавливаем движение по Y. До:", {
      allowGravity: this.player.body.allowGravity,
      gravityY: this.player.body.gravity.y,
      velocityY: this.player.body.velocity.y,
      velocityX: this.player.body.velocity.x,
    });
    this.player.body.setAllowGravity(false);
    this.player.body.setGravityY(0);
    console.log("[FLIP] После отключения гравитации:", {
      allowGravity: this.player.body.allowGravity,
      gravityY: this.player.body.gravity.y,
      fixedVelocityY: this.fixedVelocityY,
    });
    // Применяем ускорение только по X, Y устанавливаем в 0 (останавливаем движение вверх/вниз)
    this.player.setVelocity(
      this.baseVelocityX + initialBoostSpeed,
      0 // Останавливаем движение по Y
    );

    // Уведомляем о перевороте
    if (this.onFlipAction) {
      this.onFlipAction(true);
    }
  }

  // Возврат персонажа в вертикальное положение
  unflipPlayer() {
    if (!this.isFlipped) return;

    this.isFlipped = false;
    this.flipTimer = 0;

    // Возвращаем персонажа в нормальное состояние
    // Сначала возвращаем размеры коллайдера
    this.player.body.setSize(PLAYER_WIDTH, PLAYER_HEIGHT, true); // Возвращаем размеры коллайдера 40x60 с центрированием

    // Затем возвращаем угол
    this.player.setAngle(0);

    // Возвращаем размеры отображения
    this.player.setDisplaySize(PLAYER_WIDTH, PLAYER_HEIGHT);

    // Принудительно обновляем размеры тела для debug визуализации
    this.player.body.width = PLAYER_WIDTH;
    this.player.body.height = PLAYER_HEIGHT;

    // Обновляем центр коллайдера
    if (this.player.body.updateCenter) {
      this.player.body.updateCenter();
    }

    // Обновляем размеры тела через refreshBody если доступно
    if (this.player.body.refreshBody) {
      this.player.body.refreshBody();
    }

    // Восстанавливаем гравитацию при возврате из перевернутого состояния
    // Это гарантирует, что гравитация всегда восстановится после переворота

    console.log("[UNFLIP] Начало восстановления. До:", {
      allowGravity: this.player.body.allowGravity,
      gravityY: this.player.body.gravity.y,
      fixedVelocityY: this.fixedVelocityY,
      boostTimer: this.boostTimer,
      velocityY: this.player.body.velocity.y,
    });

    // Сбрасываем fixedVelocityY - теперь скорость по Y будет управляться гравитацией
    this.fixedVelocityY = null;

    // Также сбрасываем таймеры ускорения, если они еще активны
    this.boostTimer = 0;
    this.boostSpeed = 0;

    // Восстанавливаем гравитацию - используем гравитацию мира из конфигурации Phaser
    // Это гарантирует, что гравитация будет такой же, как в начале игры
    const worldGravity = this.physics.world.gravity.y;
    const gravityToRestore = worldGravity !== 0 ? worldGravity : (this.originalGravityY || GRAVITY);
    this.player.body.setAllowGravity(true);
    this.player.body.setGravityY(gravityToRestore);
    
    // Принудительно обновляем физическое тело для применения гравитации
    this.player.body.updateFromGameObject();
    
    // Убеждаемся, что гравитация действительно включена (дополнительная проверка)
    if (!this.player.body.allowGravity) {
      console.log("[UNFLIP] Гравитация была отключена, включаем снова");
      this.player.body.setAllowGravity(true);
    }
    if (this.player.body.gravity.y !== gravityToRestore) {
      console.log("[UNFLIP] Гравитация Y была неправильной, исправляем");
      this.player.body.setGravityY(gravityToRestore);
    }

    // Скорость по X остается без изменений (сохраняется текущая скорость)
    // Скорость по Y теперь будет управляться гравитацией (не фиксируем её)
    console.log("[UNFLIP] После восстановления гравитации:", {
      allowGravity: this.player.body.allowGravity,
      gravityY: this.player.body.gravity.y,
      expectedGravity: gravityToRestore,
      velocityX: this.player.body.velocity.x,
      velocityY: this.player.body.velocity.y,
      note: "Скорость по Y теперь управляется гравитацией",
    });

    // Убеждаемся, что мы не фиксируем скорость по Y - позволяем гравитации работать
    // Не устанавливаем скорость по Y вручную после этого момента

    // Уведомляем о возврате
    if (this.onFlipAction) {
      this.onFlipAction(false);
    }
  }

  // Создание вертикальной стены с отверстием (логика как в Flappy Bird)
  createWall(x, height, groundY) {
    // Генерируем случайный размер отверстия от высоты персонажа до двух высот
    const gapSize =
      WALL_GAP_MIN + Math.random() * (WALL_GAP_MAX - WALL_GAP_MIN);

    // Вычисляем позицию центра отверстия (случайная высота)
    // Отверстие должно быть доступно для прохождения
    const minGapTop = 50; // Минимальная позиция верхнего края отверстия (от верха)
    const maxGapTop = groundY - gapSize - 50; // Максимальная позиция верхнего края отверстия
    const gapTop = minGapTop + Math.random() * (maxGapTop - minGapTop);
    const gapBottom = gapTop + gapSize; // Нижний край отверстия

    // Верхняя часть стены (от верха canvas до верхнего края отверстия)
    const topWallHeight = gapTop; // Высота верхней стены = расстояние от верха до отверстия
    if (topWallHeight > 20) {
      // Создаем спрайт верхней стены
      // Используем подход из примера: origin (0, 0) - верх слева в позиции y
      // Позиционируем верх стены в верхней части canvas (y=0)
      const topWall = this.walls.create(x, 0, "wall");

      // Устанавливаем origin (как в примере)
      topWall.setOrigin(0, 0); // верх слева в позиции y

      // Устанавливаем размеры отображения
      topWall.setDisplaySize(WALL_WIDTH, topWallHeight);

      // Настраиваем физику (как в примере - без setSize, коллайдер автоматически)
      topWall.setVelocityX(-OBSTACLE_SPEED);
      topWall.body.allowGravity = false;
      topWall.body.setImmovable(true);
      topWall.setCollideWorldBounds(false);
    }

    // Нижняя часть стены (от нижнего края отверстия до земли)
    const bottomWallHeight = groundY - gapBottom; // Высота нижней стены
    if (bottomWallHeight > 20) {
      // Создаем спрайт нижней стены
      // Используем подход из примера: origin (0, 0) - верх слева в позиции y
      // Позиционируем верх стены в нижней части отверстия (y=gapBottom)
      const bottomWall = this.walls.create(x, gapBottom, "wall");

      // Устанавливаем origin (как в примере)
      bottomWall.setOrigin(0, 0); // верх слева в позиции y

      // Устанавливаем размеры отображения
      bottomWall.setDisplaySize(WALL_WIDTH, bottomWallHeight);

      // Настраиваем физику (как в примере - без setSize, коллайдер автоматически)
      bottomWall.setVelocityX(-OBSTACLE_SPEED);
      bottomWall.body.allowGravity = false;
      bottomWall.body.setImmovable(true);
      bottomWall.setCollideWorldBounds(false);

      // Логирование для отладки
      console.log("=== НИЖНЯЯ СТЕНА ===");
      console.log("Позиция спрайта (x, y):", bottomWall.x, bottomWall.y);
      console.log("Origin спрайта:", bottomWall.originX, bottomWall.originY);
      console.log(
        "Размеры спрайта (displayWidth, displayHeight):",
        bottomWall.displayWidth,
        bottomWall.displayHeight
      );
      console.log(
        "Размеры коллайдера (width, height):",
        bottomWall.body.width,
        bottomWall.body.height
      );
      console.log(
        "Offset коллайдера (x, y):",
        bottomWall.body.offset.x,
        bottomWall.body.offset.y
      );
      console.log(
        "Позиция коллайдера (x, y):",
        bottomWall.body.x,
        bottomWall.body.y
      );
      console.log("Визуальные границы спрайта:");
      console.log("  Верх:", bottomWall.y - bottomWall.displayHeight / 2);
      console.log("  Низ:", bottomWall.y + bottomWall.displayHeight / 2);
      console.log("Границы коллайдера:");
      console.log("  Верх:", bottomWall.body.top);
      console.log("  Низ:", bottomWall.body.bottom);
      console.log("  Лево:", bottomWall.body.left);
      console.log("  Право:", bottomWall.body.right);
      console.log("groundY:", groundY);
      console.log("gapBottom:", gapBottom);
    }
  }

  hitObstacle() {
    if (!this.isGameActive) return;
    
    // Новая логика: при соприкосновении со стенами не заканчиваем игру
    // Этот метод вызывается только из overlap со стенами (старая логика)
    // При новой логике этот метод не вызывается при соприкосновении со стенами
    if (NEW_WALL_LOGIC_ENABLED) {
      console.log("Hit wall! (New logic: no game over)");
      // Просто логируем, но не останавливаем игру
      // Можно добавить визуальный эффект или звук здесь
      return;
    }
    
    // Старая логика: заканчиваем игру при соприкосновении
    console.log("Hit obstacle! Game over!");
    this.isGameActive = false;
    if (this.onGameOver) {
      console.log("Calling onGameOver callback");
      this.onGameOver();
    } else {
      console.warn("onGameOver callback is not set!");
    }
    this.physics.pause();
  }

  // Метод для проигрыша при достижении левого края
  hitLeftEdge() {
    if (!this.isGameActive) return;
    
    console.log("Hit left edge! Game over!");
    this.isGameActive = false;
    if (this.onGameOver) {
      console.log("Calling onGameOver callback");
      this.onGameOver();
    } else {
      console.warn("onGameOver callback is not set!");
    }
    this.physics.pause();
  }

  // Метод для сброса состояния перед перезапуском
  resetState() {
    this.scoreValue = 0;
    this.platformSpawnTimer = 0;
    this.wallSpawnTimer = 0; // Сбрасываем таймер стен
    this.isGameActive = true;
    this.jumpCount = 0; // Сбрасываем счетчик прыжков
    this.isJumpAccelerating = false; // Сбрасываем флаг ускорения прыжка
    this.jumpAccelerationTimer = 0; // Сбрасываем таймер ускорения прыжка
    this.isChargingJump = false; // Сбрасываем флаг зарядки прыжка
    this.jumpCharge = 0; // Сбрасываем накопленную силу
    this.chargeTimer = 0; // Сбрасываем таймер зарядки
    this.isPointerDown = false; // Сбрасываем флаг нажатия мыши/тача
    this.wasPointerDown = false; // Сбрасываем предыдущее состояние мыши/тача
    this.isSpaceDown = false; // Сбрасываем флаг нажатия пробела
    this.wasSpaceDown = false; // Сбрасываем предыдущее состояние пробела
    // Сбрасываем состояние переворота
    if (this.isFlipped) {
      this.unflipPlayer();
    }
    this.flipTimer = 0;
    this.boostTimer = 0;
    this.boostSpeed = 0;
    this.fixedVelocityY = null;
    this.debugLogTimer = 0;
    this.returnToPositionTimer = 0; // Сбрасываем таймер возврата в исходную позицию
    this.mapObstaclesCreated = false; // Сбрасываем флаг создания препятствий из карты
    this.mapProgress = 0; // Сбрасываем прогресс по карте
    this.spawnedObstacles = new Set(); // Очищаем множество созданных препятствий
    // Убеждаемся, что гравитация включена при сбросе состояния
    if (this.player && this.player.body) {
      const worldGravity = this.physics.world.gravity.y;
      const gravityToRestore = worldGravity !== 0 ? worldGravity : (this.originalGravityY || GRAVITY);
      console.log("[RESET] Восстанавливаем гравитацию при сбросе. До:", {
        allowGravity: this.player.body.allowGravity,
        gravityY: this.player.body.gravity.y,
        worldGravity: worldGravity,
        expectedGravity: gravityToRestore,
      });
      this.player.body.setAllowGravity(true);
      this.player.body.setGravityY(gravityToRestore);
      // Сбрасываем ускорение прыжка
      this.player.body.setAccelerationY(0);
      // Возвращаем персонажа в исходную позицию по X
      if (this.originalPositionX !== null) {
        this.player.x = this.originalPositionX;
        this.player.body.x = this.originalPositionX;
        this.player.body.updateFromGameObject();
      }
      console.log("[RESET] После восстановления:", {
        allowGravity: this.player.body.allowGravity,
        gravityY: this.player.body.gravity.y,
        expectedGravity: gravityToRestore,
        positionX: this.player.x,
      });
    }
  }

  update(time, delta) {
    if (!this.isGameActive) return;

    // Сохраняем реальную гравитацию персонажа при первом обновлении (если еще не сохранена)
    // Или обновляем, если гравитация изменилась и персонаж не перевернут
    if (this.player && this.player.body && !this.isFlipped && this.boostTimer <= 0) {
      const currentGravity = this.player.body.gravity.y;
      // Сохраняем гравитацию, если она еще не сохранена или если она отличается от сохраненной
      // и персонаж в нормальном состоянии (не перевернут)
      if (currentGravity !== 0) {
        if (this.originalGravityY === null || this.originalGravityY === undefined) {
          this.originalGravityY = currentGravity;
          console.log("[UPDATE] Сохраняем реальную гравитацию персонажа при первом обновлении:", {
            originalGravityY: this.originalGravityY,
            bodyGravityY: currentGravity,
          });
        } else if (Math.abs(this.originalGravityY - currentGravity) > 1 && currentGravity < this.originalGravityY) {
          // Если текущая гравитация меньше сохраненной (и персонаж не перевернут), обновляем
          // Это может быть реальная изначальная гравитация
          this.originalGravityY = currentGravity;
          console.log("[UPDATE] Обновляем сохраненную гравитацию (найдена меньшая):", {
            oldOriginalGravityY: this.originalGravityY,
            newOriginalGravityY: currentGravity,
          });
        }
      }
    }

    // Периодическое логирование состояния гравитации (раз в секунду)
    this.debugLogTimer += delta;
    if (this.debugLogTimer >= 1000) {
      this.debugLogTimer = 0;
      if (this.player && this.player.body) {
        const expectedGravity = this.originalGravityY || GRAVITY;
        console.log("[DEBUG] Состояние гравитации каждый кадр:", {
          allowGravity: this.player.body.allowGravity,
          gravityY: this.player.body.gravity.y,
          expectedGravity: expectedGravity,
          originalGravityY: this.originalGravityY,
          isFlipped: this.isFlipped,
          boostTimer: this.boostTimer,
          fixedVelocityY: this.fixedVelocityY,
          velocityY: this.player.body.velocity.y,
        });
      }
    }

    // Проверка: если персонаж достиг левого края canvas - проигрыш
    // Это единственный способ проиграть (независимо от логики стен)
    if (this.player.x <= 0) {
      this.hitLeftEdge();
      return;
    }

    // Минимальное время между генерацией платформы и стены (мс)
    const minTimeBetweenSpawns = 500;

    // Отслеживаем состояние кнопок мыши/тача
    const pointerIsDown = this.input.activePointer.isDown;
    const spaceIsDown = this.spaceKey && this.spaceKey.isDown;
    
    // Проверяем, стоит ли персонаж на земле или платформе
    const isOnGround =
      this.player.body.touching.down || this.player.body.onFloor();

    // Если на земле, сбрасываем счетчик прыжков
    if (isOnGround) {
      this.jumpCount = 0;
    }

    // Определяем, нажата ли кнопка прыжка (мышь/тач или пробел)
    const jumpButtonDown = pointerIsDown || spaceIsDown;
    const jumpButtonJustPressed = jumpButtonDown && (!this.wasPointerDown && !this.wasSpaceDown);

    // Обработка начала зарядки (когда кнопка только что нажата)
    if (jumpButtonJustPressed) {
      if (isOnGround && this.jumpCount === 0) {
        // Для первого прыжка (когда на земле) начинаем зарядку
        this.isChargingJump = true;
        this.jumpCharge = 0;
        this.chargeTimer = 0;
      } else {
        // Для дополнительных прыжков сразу выполняем прыжок
        this.jump(JUMP_STRENGTH);
      }
    }

    // Обработка зарядки первого прыжка
    if (this.isChargingJump) {
      if (!isOnGround) {
        // Персонаж оторвался от земли - отменяем зарядку и выполняем прыжок с минимальной силой
        this.jump(JUMP_STRENGTH);
        this.isChargingJump = false;
        this.jumpCharge = 0;
        this.chargeTimer = 0;
      } else if (jumpButtonDown) {
        // Кнопка все еще нажата - продолжаем зарядку
        this.chargeTimer += delta;
        // Накопление силы от 0 до 1 за время maxJumpChargeTime
        this.jumpCharge = Math.min(1, this.chargeTimer / this.maxJumpChargeTime);
      } else {
        // Кнопка отпущена - выполняем прыжок с накопленной силой
        const minJumpStrength = JUMP_STRENGTH;
        const maxJumpStrength = JUMP_STRENGTH * 2;
        const jumpStrength = minJumpStrength + (maxJumpStrength - minJumpStrength) * this.jumpCharge;
        
        this.jump(jumpStrength);
        this.isChargingJump = false;
        this.jumpCharge = 0;
        this.chargeTimer = 0;
      }
    }

    // Всегда обновляем визуальный индикатор (даже когда зарядка не активна, чтобы показывать 0%)
    this.updateChargeIndicator();

    // Сохраняем текущее состояние для следующего кадра
    this.wasPointerDown = pointerIsDown;
    this.wasSpaceDown = spaceIsDown;

    // Обработка ускорения прыжка (контроль скорости набора высоты)
    // Используем прямое изменение скорости вместо ускорения для лучшего контроля
    if (this.isJumpAccelerating && this.jumpAccelerationTimer > 0) {
      this.jumpAccelerationTimer -= delta;
      
      // Применяем ускорение напрямую к скорости каждый кадр
      // JUMP_ACCELERATION - это скорость изменения скорости (пикселей в секунду в секунду)
      const accelerationPerFrame = (JUMP_ACCELERATION * delta) / 1000; // Преобразуем в пиксели за кадр
      const currentVelocityY = this.player.body.velocity.y;
      const newVelocityY = currentVelocityY + accelerationPerFrame;
      
      // Устанавливаем новую скорость, но не позволяем ей стать слишком большой
      // Ограничиваем максимальную скорость подъема
      const maxUpwardVelocity = -1000; // Максимальная скорость вверх (увеличено для более быстрого подъема)
      const finalVelocityY = Math.max(newVelocityY, maxUpwardVelocity);
      this.player.setVelocityY(finalVelocityY);
      
      if (this.jumpAccelerationTimer <= 0) {
        // Время ускорения закончилось
        this.jumpAccelerationTimer = 0;
        this.isJumpAccelerating = false;
      }
    } else if (this.isJumpAccelerating) {
      // Если таймер закончился, но флаг еще активен - сбрасываем
      this.isJumpAccelerating = false;
      this.jumpAccelerationTimer = 0;
    }

    // Обработка таймера ускорения при перевороте
    // Фиксируем скорость по Y только если переворот активен И fixedVelocityY установлен
    if (this.boostTimer > 0 && this.isFlipped && this.fixedVelocityY !== null) {
      const previousBoostSpeed = this.boostSpeed;
      this.boostTimer -= delta;
      // Постепенно уменьшаем ускорение до нуля за 1 секунду
      const boostProgress = Math.max(0, this.boostTimer / 1000); // От 1 до 0
      this.boostSpeed = 300 * boostProgress; // От 300 до 0

      // Компенсируем изменение ускорения в скорости
      const boostChange = previousBoostSpeed - this.boostSpeed;
      const currentVelocityX = this.player.body.velocity.x;

      // Поддерживаем гравитацию отключенной во время ускорения
      this.player.body.setAllowGravity(false);
      this.player.body.setGravityY(0);
      // Фиксируем скорость по Y на 0 (останавливаем движение вверх/вниз)
      // Ускоряем только по X (вправо)
      this.player.setVelocity(
        currentVelocityX - boostChange,
        0 // Всегда 0 во время переворота
      );

      if (this.boostTimer <= 0) {
        console.log("[UPDATE] boostTimer закончился, восстанавливаем гравитацию. До:", {
          allowGravity: this.player.body.allowGravity,
          gravityY: this.player.body.gravity.y,
          fixedVelocityY: this.fixedVelocityY,
          isFlipped: this.isFlipped,
        });
        this.boostTimer = 0;
        this.boostSpeed = 0;
        // Восстанавливаем гравитацию после завершения ускорения
        // Используем гравитацию мира из конфигурации Phaser
        const worldGravity = this.physics.world.gravity.y;
        const gravityToRestore = worldGravity !== 0 ? worldGravity : (this.originalGravityY || GRAVITY);
        this.player.body.setAllowGravity(true);
        this.player.body.setGravityY(gravityToRestore);
        this.fixedVelocityY = null;
        // Убираем остаточное ускорение только по X, Y теперь управляется гравитацией
        this.player.setVelocityX(this.player.body.velocity.x - this.boostSpeed);
        console.log("[UPDATE] После восстановления гравитации:", {
          allowGravity: this.player.body.allowGravity,
          gravityY: this.player.body.gravity.y,
          expectedGravity: gravityToRestore,
        });
      }
    } else if (this.boostTimer > 0 && !this.isFlipped) {
      // Если ускорение еще идет, но переворот закончился - просто обновляем скорость по X
      console.log("[UPDATE] boostTimer > 0, но isFlipped = false. Состояние:", {
        boostTimer: this.boostTimer,
        isFlipped: this.isFlipped,
        allowGravity: this.player.body.allowGravity,
        gravityY: this.player.body.gravity.y,
      });
      const previousBoostSpeed = this.boostSpeed;
      this.boostTimer -= delta;
      const boostProgress = Math.max(0, this.boostTimer / 1000);
      this.boostSpeed = 300 * boostProgress;
      const boostChange = previousBoostSpeed - this.boostSpeed;
      const currentVelocityX = this.player.body.velocity.x;
      this.player.setVelocityX(currentVelocityX - boostChange);

      if (this.boostTimer <= 0) {
        console.log("[UPDATE] boostTimer закончился (isFlipped=false), восстанавливаем гравитацию. До:", {
          allowGravity: this.player.body.allowGravity,
          gravityY: this.player.body.gravity.y,
        });
        this.boostTimer = 0;
        this.boostSpeed = 0;
        this.player.setVelocityX(this.player.body.velocity.x - this.boostSpeed);
        // Убеждаемся, что гравитация включена после завершения ускорения
        const worldGravity = this.physics.world.gravity.y;
        const gravityToRestore = worldGravity !== 0 ? worldGravity : (this.originalGravityY || GRAVITY);
        if (!this.player.body.allowGravity) {
          console.log("[UPDATE] Гравитация была отключена, включаем");
          this.player.body.setAllowGravity(true);
          this.player.body.setGravityY(gravityToRestore);
        }
        this.fixedVelocityY = null;
        console.log("[UPDATE] После восстановления гравитации:", {
          allowGravity: this.player.body.allowGravity,
          gravityY: this.player.body.gravity.y,
          expectedGravity: gravityToRestore,
        });
      }
    } else if (this.boostTimer <= 0 && this.fixedVelocityY !== null) {
      // Если таймер закончился, но fixedVelocityY еще установлен - очищаем его и восстанавливаем гравитацию
      console.log("[UPDATE] boostTimer <= 0, но fixedVelocityY !== null. Восстанавливаем гравитацию:", {
        boostTimer: this.boostTimer,
        fixedVelocityY: this.fixedVelocityY,
        allowGravity: this.player.body.allowGravity,
        gravityY: this.player.body.gravity.y,
      });
      this.fixedVelocityY = null;
      const worldGravity = this.physics.world.gravity.y;
      const gravityToRestore = worldGravity !== 0 ? worldGravity : (this.originalGravityY || GRAVITY);
      this.player.body.setAllowGravity(true);
      this.player.body.setGravityY(gravityToRestore);
      console.log("[UPDATE] После восстановления:", {
        allowGravity: this.player.body.allowGravity,
        gravityY: this.player.body.gravity.y,
      });
    }

    // Обработка таймера переворота
    if (this.isFlipped && this.flipTimer > 0) {
      this.flipTimer -= delta;
      if (this.flipTimer <= 0) {
        this.unflipPlayer();
      } else {
        // Постоянно обновляем размеры коллайдера когда перевернут
        // Это гарантирует, что коллайдер правильно отображается в debug режиме
        if (this.player && this.player.body) {
          this.player.body.setSize(PLAYER_HEIGHT, PLAYER_WIDTH, true);
          this.player.body.width = PLAYER_HEIGHT;
          this.player.body.height = PLAYER_WIDTH;
          this.player.body.updateCenter();
        }
      }
    }

    // Страховка: если персонаж не перевернут и boostTimer = 0, гравитация должна быть включена
    if (!this.isFlipped && this.boostTimer <= 0 && this.fixedVelocityY === null) {
      if (this.player && this.player.body) {
        const worldGravity = this.physics.world.gravity.y;
        const gravityToRestore = worldGravity !== 0 ? worldGravity : (this.originalGravityY || GRAVITY);
        if (!this.player.body.allowGravity || this.player.body.gravity.y !== gravityToRestore) {
          console.log("[UPDATE] Страховка: восстанавливаем гравитацию. Было:", {
            allowGravity: this.player.body.allowGravity,
            gravityY: this.player.body.gravity.y,
            expectedGravity: gravityToRestore,
          });
          this.player.body.setAllowGravity(true);
          this.player.body.setGravityY(gravityToRestore);
          console.log("[UPDATE] Страховка: после восстановления:", {
            allowGravity: this.player.body.allowGravity,
            gravityY: this.player.body.gravity.y,
          });
        }
      }
    }

    // Восстановление движения: если персонаж был заблокирован препятствием, но теперь не касается его
    // нужно убедиться, что он может свободно двигаться (падать под действием гравитации)
    if (this.player && this.player.body && !this.isFlipped && this.boostTimer <= 0) {
      const isTouchingLeft = this.player.body.touching.left;
      const isTouchingRight = this.player.body.touching.right;
      const isTouchingDown = this.player.body.touching.down;
      const velocityX = this.player.body.velocity.x;
      const velocityY = this.player.body.velocity.y;
      
      // Если персонаж не касается препятствий сбоку и снизу, но скорость по Y = 0 (заблокирован)
      // это означает, что он был заблокирован препятствием, но теперь препятствие ушло
      // Нужно убедиться, что гравитация работает и персонаж может падать
      if (!isTouchingLeft && !isTouchingRight && !isTouchingDown && Math.abs(velocityY) < 0.1) {
        // Персонаж не касается препятствий, но не падает - возможно заблокирован
        // Принудительно обновляем физическое тело, чтобы гравитация работала
        this.player.body.updateFromGameObject();
        
        // Если гравитация включена, но скорость по Y все еще 0, принудительно применяем гравитацию
        if (this.player.body.allowGravity && this.player.body.gravity.y !== 0) {
          // Не устанавливаем скорость напрямую, но обновляем тело для применения гравитации
          this.player.body.updateFromGameObject();
        }
      }
      
      // В этой игре персонаж должен быть неподвижен по X (скорость = 0)
      // Но если он был заблокирован препятствием и теперь не касается его, убеждаемся что скорость = 0
      // НО: не сбрасываем скорость во время прыжка (когда персонаж в воздухе)
      const isInAir = !isTouchingDown && Math.abs(velocityY) > 10;
      if (Math.abs(velocityX) > 0.1 && !isTouchingLeft && !isTouchingRight && !isInAir) {
        // Персонаж движется по X, но не касается препятствий и не в воздухе - сбрасываем скорость
        this.player.setVelocityX(0);
      } else if (isInAir && velocityX > 0) {
        // Персонаж в воздухе и движется вперед - применяем замедление
        const deceleration = (this.jumpForwardDeceleration * delta) / 1000;
        const newVelocityX = Math.max(0, velocityX - deceleration);
        this.player.setVelocityX(newVelocityX);
      }
    }

    // Логика постепенного возврата персонажа в изначальное положение по X
    if (
      this.player &&
      this.player.body &&
      this.originalPositionX !== null &&
      !this.isFlipped &&
      this.boostTimer <= 0
    ) {
      const currentX = this.player.x;
      const targetX = this.originalPositionX;
      const distance = Math.abs(currentX - targetX);
      const threshold = 5; // Порог, ниже которого считаем, что персонаж уже на месте

      // Проверяем, не касается ли персонаж препятствий сбоку
      const isTouchingLeft = this.player.body.touching.left;
      const isTouchingRight = this.player.body.touching.right;
      const isTouchingObstacle = isTouchingLeft || isTouchingRight;

      if (distance > threshold) {
        // Персонаж отклонился от изначальной позиции
        if (!isTouchingObstacle) {
          // Не касается препятствий - запускаем или продолжаем таймер
          this.returnToPositionTimer += delta;

          if (this.returnToPositionTimer >= this.returnDelay) {
            // Задержка прошла - начинаем плавный возврат через скорость
            // Используем скорость по X вместо прямого изменения позиции, чтобы не блокировать движение по Y
            const direction = currentX < targetX ? 1 : -1; // Направление возврата
            const remainingDistance = Math.abs(currentX - targetX);
            
            // Проверяем, не достигли ли мы целевой позиции
            if (remainingDistance < 5) {
              // Достигли целевой позиции - останавливаем движение по X
              this.player.setVelocityX(0);
              this.returnToPositionTimer = 0; // Сбрасываем таймер
            } else {
              // Устанавливаем скорость по X для возврата, сохраняя скорость по Y
              const currentVelocityY = this.player.body.velocity.y; // Сохраняем скорость по Y
              this.player.setVelocityX(direction * this.returnSpeed);
              // Убеждаемся, что скорость по Y не изменилась
              if (Math.abs(this.player.body.velocity.y - currentVelocityY) > 0.1) {
                this.player.setVelocityY(currentVelocityY);
              }
            }
          }
        } else {
          // Касается препятствия - сбрасываем таймер
          this.returnToPositionTimer = 0;
        }
      } else {
        // Персонаж уже на месте - сбрасываем таймер
        this.returnToPositionTimer = 0;
      }
    } else {
      // Во время переворота или ускорения - сбрасываем таймер
      this.returnToPositionTimer = 0;
    }

    // Сбрасываем счетчик прыжков при приземлении
    if (
      this.player &&
      (this.player.body.touching.down || this.player.body.onFloor())
    ) {
      this.jumpCount = 0;
    }

    const { width, height } = this.scale;
    const groundY = height * 0.6;

    // Если используется сохраненная карта, не генерируем препятствия динамически
    if (this.useSavedMap) {
      // Обновляем прогресс по карте (препятствия движутся навстречу игроку)
      this.mapProgress += (OBSTACLE_SPEED * delta) / 1000;
      
      // Создаем новые препятствия из карты по мере продвижения
      this.createMapObstacles();
      
      // Удаление объектов за экраном и подсчет счета
      this.platforms.children.entries.forEach((platform) => {
        if (platform.x + PLATFORM_WIDTH < 0) {
          platform.destroy();
        }
      });

      // Удаление стен за экраном и подсчет счета
      let wallPassed = false;
      this.walls.children.entries.forEach((wall) => {
        if (wall.x + WALL_WIDTH < 0) {
          // Проверяем, прошел ли игрок через стену (отверстие)
          if (
            wall.x + WALL_WIDTH < this.player.x &&
            wall.x + WALL_WIDTH >= this.player.x - 10 &&
            !wallPassed
          ) {
            wallPassed = true;
            this.scoreValue++;
            if (this.onScoreUpdate) {
              this.onScoreUpdate(this.scoreValue);
            }
            this.scoreText.setText(`Счет: ${this.scoreValue}`);
          }
          wall.destroy();
        }
      });
      
      // Проверяем, закончилась ли карта
      if (this.mapData && this.mapProgress >= this.mapData.length) {
        // Карта закончилась - можно показать сообщение или завершить уровень
        console.log("Карта пройдена!");
      }
      
      return; // Прерываем выполнение, не генерируя новые препятствия
    }

    // Создание платформ (динамическая генерация)
    this.platformSpawnTimer += delta;
    if (this.platformSpawnTimer >= PLATFORM_SPAWN_INTERVAL) {
      // Проверяем, не будет ли создана стена в ближайшее время
      // Если стена скоро появится, не создаем платформу
      const timeUntilWallSpawn = WALL_SPAWN_INTERVAL - this.wallSpawnTimer;

      if (timeUntilWallSpawn < minTimeBetweenSpawns) {
        // Слишком близко к генерации стены, пропускаем создание платформы
        this.platformSpawnTimer = 0;
      } else {
        // Проверяем расстояние до последней платформы
        let canSpawn = true;
        const platformsArray = this.platforms.children.entries;

        if (platformsArray.length > 0) {
          // Находим самую правую платформу (ближайшую к точке спавна)
          let lastPlatformX = -Infinity;
          for (const platform of platformsArray) {
            if (platform.x > lastPlatformX) {
              lastPlatformX = platform.x;
            }
          }

          // Проверяем, достаточно ли расстояние до последней платформы
          const distanceToLast = width - (lastPlatformX + PLATFORM_WIDTH);
          if (distanceToLast < PLATFORM_MIN_DISTANCE) {
            canSpawn = false;
          }
        }

        if (canSpawn) {
          const minHeight = height * 0.1;
          const maxHeight = height * 0.3;

          // Пытаемся найти подходящую высоту, которая не пересекается с существующими платформами
          let platformY = 0;
          let attempts = 0;
          let foundValidPosition = false;

          while (!foundValidPosition && attempts < 10) {
            const platformHeight =
              minHeight + Math.random() * (maxHeight - minHeight);
            platformY = groundY - platformHeight - PLATFORM_HEIGHT / 2;

            // Проверяем пересечение с существующими платформами
            let hasOverlap = false;
            for (const existingPlatform of platformsArray) {
              // Проверяем, если платформы находятся близко по X (в пределах минимального расстояния)
              const xDistance = Math.abs(width - existingPlatform.x);
              if (xDistance < PLATFORM_MIN_DISTANCE) {
                // Проверяем пересечение по Y
                const existingTop = existingPlatform.y - PLATFORM_HEIGHT / 2;
                const existingBottom = existingPlatform.y + PLATFORM_HEIGHT / 2;
                const newTop = platformY - PLATFORM_HEIGHT / 2;
                const newBottom = platformY + PLATFORM_HEIGHT / 2;

                // Проверяем перекрытие
                if (
                  (newTop < existingBottom && newBottom > existingTop) ||
                  (newTop === existingTop && newBottom === existingBottom)
                ) {
                  hasOverlap = true;
                  break;
                }
              }
            }

            // Проверяем пересечение со стенами
            if (!hasOverlap && this.walls && this.walls.children) {
              const wallsArray = this.walls.children.entries;
              const checkDistance = PLATFORM_MIN_DISTANCE + WALL_WIDTH; // Учитываем ширину стены

              for (const wall of wallsArray) {
                // Проверяем, если стена находится близко по X
                const xDistance = Math.abs(width - wall.x);
                if (xDistance < checkDistance) {
                  // Проверяем пересечение по Y
                  // Используем displayHeight для визуальной высоты стены
                  const wallHeight =
                    wall.displayHeight ||
                    wall.height ||
                    (wall.body ? wall.body.height : 0);
                  const wallTop = wall.y - wallHeight / 2;
                  const wallBottom = wall.y + wallHeight / 2;
                  const platformTop = platformY - PLATFORM_HEIGHT / 2;
                  const platformBottom = platformY + PLATFORM_HEIGHT / 2;

                  // Проверяем перекрытие
                  if (platformTop < wallBottom && platformBottom > wallTop) {
                    hasOverlap = true;
                    break;
                  }
                }
              }

              // Также проверяем, не будет ли создана стена в ближайшее время на этой позиции
              const timeUntilWallSpawn =
                WALL_SPAWN_INTERVAL - this.wallSpawnTimer;
              if (timeUntilWallSpawn < minTimeBetweenSpawns) {
                // Стена скоро будет создана, считаем что она уже есть на позиции width
                // Проверяем, не пересечется ли платформа с потенциальной стеной
                // Для безопасности считаем, что стена может быть на любой высоте
                // и если платформа находится в зоне возможного создания стены, пропускаем
                hasOverlap = true;
              }
            }

            if (!hasOverlap) {
              foundValidPosition = true;
            }
            attempts++;
          }

          // Создаем платформу только если нашли валидную позицию
          if (foundValidPosition) {
            const platform = this.platforms.create(
              width,
              platformY,
              "platform"
            );
            platform.setVelocityX(-OBSTACLE_SPEED);
            platform.body.setSize(PLATFORM_WIDTH, PLATFORM_HEIGHT);
            platform.body.setGravityY(0); // Отключаем гравитацию
            platform.body.setAllowGravity(false); // Запрещаем гравитацию
            platform.body.setImmovable(true); // Делаем неподвижным
            platform.setCollideWorldBounds(false); // Не сталкиваемся с границами мира
          }

          this.platformSpawnTimer = 0;
        }
      }
    }

    // Создание вертикальных стен с отверстиями
    this.wallSpawnTimer += delta;
    if (this.wallSpawnTimer >= WALL_SPAWN_INTERVAL) {
      // Проверяем, не будет ли создана платформа в ближайшее время
      // Если платформа скоро появится, не создаем стену
      const timeUntilPlatformSpawn =
        PLATFORM_SPAWN_INTERVAL - this.platformSpawnTimer;

      if (timeUntilPlatformSpawn < minTimeBetweenSpawns) {
        // Слишком близко к генерации платформы, пропускаем создание стены в этом кадре
        // НЕ сбрасываем таймер - он продолжит расти, и стена сгенерируется в следующем кадре
        // когда условие не будет выполняться
        // Ограничиваем таймер, чтобы он не рос бесконечно
        if (this.wallSpawnTimer > WALL_SPAWN_INTERVAL * 2) {
          // Если таймер слишком большой (стена долго не генерировалась), принудительно создаем
          this.createWall(width, height, groundY);
          this.wallSpawnTimer = 0;
        }
      } else {
        this.createWall(width, height, groundY);
        this.wallSpawnTimer = 0;
      }
    }

    // Удаление объектов за экраном и подсчет счета
    this.platforms.children.entries.forEach((platform) => {
      if (platform.x + PLATFORM_WIDTH < 0) {
        platform.destroy();
      }
    });

    // Удаление стен за экраном и подсчет счета
    let wallPassed = false;
    this.walls.children.entries.forEach((wall) => {
      if (wall.x + WALL_WIDTH < 0) {
        // Проверяем, прошел ли игрок через стену (отверстие)
        if (
          wall.x + WALL_WIDTH < this.player.x &&
          wall.x + WALL_WIDTH >= this.player.x - 10 &&
          !wallPassed
        ) {
          wallPassed = true;
          this.scoreValue++;
          if (this.onScoreUpdate) {
            this.onScoreUpdate(this.scoreValue);
          }
          this.scoreText.setText(`Счет: ${this.scoreValue}`);
        }
        wall.destroy();
      }
    });
  }
}

function GameRunner() {
  const gameRef = useRef(null);
  const phaserGameRef = useRef(null);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [showMapGenerator, setShowMapGenerator] = useState(false);

  // Функция для переворота персонажа
  const handleFlip = useCallback(() => {
    const scene = phaserGameRef.current?.scene.getScene("GameScene");
    if (scene && scene.isGameActive) {
      scene.flipPlayer();
    }
  }, []);

  // Инициализация Phaser игры
  useEffect(() => {
    if (!isGameStarted || !gameRef.current) return;

    // Увеличиваем размеры canvas для большего видимого пространства
    const scaleFactor = 1.8; // Коэффициент увеличения (20% больше)
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
          gravity: { y: GRAVITY },
          debug: true, // Включаем debug режим для визуализации коллайдеров
        },
      },
      scene: [GameScene],
      backgroundColor: "#f0f0f0",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    phaserGameRef.current = new Phaser.Game(config);

    // Передаем колбэки в сцену после её создания
    const setupCallbacks = () => {
      const scene = phaserGameRef.current?.scene.getScene("GameScene");
      if (scene) {
        scene.onScoreUpdate = setScore;
        scene.onGameOver = () => {
          console.log("Game Over callback called, setting isGameOver to true");
          setIsGameOver(true);
        };
        // Сохраняем функцию переворота в сцене для доступа из кнопки
        scene.flipAction = handleFlip;
        console.log("Callbacks set up in scene:", scene);
      } else {
        console.warn("Scene not found when setting up callbacks");
      }
    };

    // Устанавливаем колбэки после небольшой задержки, чтобы сцена успела инициализироваться
    setTimeout(() => {
      setupCallbacks();
    }, 100);

    // Также устанавливаем колбэки после события create сцены
    const scene = phaserGameRef.current.scene.getScene("GameScene");
    if (scene) {
      scene.events.once("create", () => {
        console.log("Scene created, setting up callbacks");
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
  }, [isGameStarted, handleFlip]);

  const handleStart = () => {
    setIsGameStarted(true);
    setIsGameOver(false);
    setScore(0);
  };

  const handleRestart = () => {
    // Сбрасываем состояние React
    setIsGameOver(false);
    setScore(0);

    // Перезапускаем сцену, если игра запущена
    if (phaserGameRef.current && isGameStarted) {
      const scene = phaserGameRef.current.scene.getScene("GameScene");
      if (scene) {
        // Сбрасываем состояние сцены перед перезапуском
        scene.resetState();

        // Перезапускаем сцену (Phaser автоматически очистит все объекты и вызовет create заново)
        scene.scene.restart();

        // Устанавливаем колбэки после небольшой задержки, чтобы сцена успела перезапуститься
        setTimeout(() => {
          const newScene = phaserGameRef.current?.scene.getScene("GameScene");
          if (newScene) {
            newScene.onScoreUpdate = setScore;
            newScene.onGameOver = () => setIsGameOver(true);
            newScene.flipAction = handleFlip;
            // Убеждаемся, что физика активна
            if (newScene.physics) {
              newScene.physics.resume();
            }
          }
        }, 100);
      } else {
        // Если сцена не найдена, пересоздаем игру
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
        setIsGameStarted(false);
        setTimeout(() => {
          setIsGameStarted(true);
        }, 100);
      }
    } else {
      // Если игра не запущена, запускаем заново
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
          <h2 className="game-title">Бегун</h2>
          <span className="game-version">v{APP_VERSION}</span>
        </div>
      </div>

      <div className="game-area">
        {showMapGenerator ? (
          <MapGenerator
            onSave={() => {
              setShowMapGenerator(false);
              alert("Карта сохранена! Теперь она будет использоваться при запуске игры.");
            }}
            onCancel={() => setShowMapGenerator(false)}
          />
        ) : !isGameStarted ? (
          <div className="game-menu">
            <div className="game-menu-content">
              <h2 className="game-menu-title">Бегун</h2>
              <p style={{ color: "#666", marginBottom: "20px" }}>
                Перепрыгивайте препятствия! Нажмите пробел или коснитесь экрана
                для прыжка.
              </p>

              <button className="game-menu-button" onClick={handleStart}>
                Старт
              </button>
              <button
                className="game-menu-button"
                onClick={() => setShowMapGenerator(true)}
                style={{
                  backgroundColor: "#17a2b8",
                  marginTop: "10px",
                }}
              >
                Генератор карты
              </button>
            </div>
          </div>
        ) : (
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
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
            {/* Отладочная информация - можно убрать после проверки */}
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "rgba(0,0,0,0.7)",
                color: "white",
                padding: "5px",
                zIndex: 2000,
                fontSize: "12px",
              }}
            >
              isGameOver: {isGameOver ? "true" : "false"} | score: {score}
            </div>
            {/* Кнопка переворота персонажа - под поверхностью земли */}
            {!isGameOver && (
              <button
                onClick={handleFlip}
                style={{
                  position: "absolute",
                  top: "65%", // Под землей (земля на 60%)
                  right: "20px",
                  padding: "12px 24px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  color: "#ffffff",
                  background: "#ff6b6b",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer",
                  zIndex: 1000,
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                  transition: "transform 0.1s ease, opacity 0.2s ease",
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "scale(0.95)";
                  e.currentTarget.style.opacity = "0.8";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.opacity = "1";
                }}
              >
                Перевернуть
              </button>
            )}
            {isGameOver ? (
              <div className="game-overlay" style={{ display: "flex" }}>
                <div className="game-overlay-content">
                  <h2>Игра окончена!</h2>
                  <p>Ваш счет: {score}</p>
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

export default GameRunner;
