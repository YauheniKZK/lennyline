import { useEffect, useRef, useState, useCallback } from "react";
import Phaser from "phaser";
import "./Game.css";
import packageJson from "../../package.json";

// Версия приложения
const APP_VERSION = packageJson.version;

// Константы игры
const GRAVITY = 600;
const JUMP_STRENGTH = -400;
const OBSTACLE_SPEED = 200;
const PLATFORM_SPAWN_INTERVAL = 3000;
const WALL_SPAWN_INTERVAL = 4000; // Интервал появления вертикальных стен
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const PLATFORM_WIDTH = 80;
const PLATFORM_HEIGHT = 15;
const PLATFORM_MIN_DISTANCE = 200; // Минимальное расстояние между платформами
const WALL_WIDTH = 40; // Ширина вертикальной стены
const WALL_GAP_MIN = PLAYER_HEIGHT * 2; // Минимальный размер отверстия (два персонажа)
const WALL_GAP_MAX = PLAYER_HEIGHT * 3; // Максимальный размер отверстия (три персонажа)

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
    this.maxJumps = 2; // Максимальное количество прыжков
    this.isFlipped = false; // Флаг переворота персонажа
    this.flipTimer = 0; // Таймер для возврата из перевернутого состояния
    this.boostTimer = 0; // Таймер ускорения при перевороте
    this.boostSpeed = 0; // Текущая скорость ускорения
    this.baseVelocityX = 0; // Базовая скорость по X без ускорения
    this.fixedVelocityY = null; // Фиксированная скорость по Y во время ускорения
    this.onFlipAction = null; // Колбэк для уведомления о перевороте
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
    this.player = this.physics.add.sprite(
      width * 0.2,
      groundY - PLAYER_HEIGHT / 2,
      "player"
    );
    this.player.setCollideWorldBounds(false);
    this.player.body.setSize(PLAYER_WIDTH, PLAYER_HEIGHT);

    // Группы для платформ
    this.platforms = this.physics.add.group();
    this.walls = this.physics.add.group(); // Группа для вертикальных стен

    // Физика столкновений
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.platforms);
    // Столкновение со стенами
    this.physics.add.overlap(
      this.player,
      this.walls,
      this.hitObstacle,
      null,
      this
    );

    // Текст счета
    this.scoreText = this.add.text(20, 20, "Счет: 0", {
      fontSize: "24px",
      fill: "#000",
      fontFamily: "Arial",
    });

    // Управление
    this.input.keyboard.on("keydown-SPACE", this.jump, this);
    this.input.on("pointerdown", this.jump, this);

    // Убеждаемся, что физика активна (на случай перезапуска)
    this.physics.resume();
  }

  jump() {
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
      this.player.setVelocityY(JUMP_STRENGTH);
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

    // Добавляем ускорение вперед при перевороте (длится 1 секунду)
    const initialBoostSpeed = 300; // Начальная скорость ускорения вперед
    this.baseVelocityX = this.player.body.velocity.x; // Сохраняем базовую скорость
    this.boostSpeed = initialBoostSpeed;
    this.boostTimer = 1000; // 1 секунда в миллисекундах
    // Сохраняем и фиксируем скорость по Y на время ускорения
    this.fixedVelocityY = this.player.body.velocity.y;
    // Полностью отключаем гравитацию на время ускорения
    this.player.body.setAllowGravity(false);
    this.player.body.setGravityY(0);
    // Применяем ускорение только по X, Y остается фиксированным
    this.player.setVelocity(
      this.baseVelocityX + initialBoostSpeed,
      this.fixedVelocityY
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

    // Сбрасываем fixedVelocityY если он еще установлен
    this.fixedVelocityY = null;

    // Также сбрасываем таймеры ускорения, если они еще активны
    this.boostTimer = 0;
    this.boostSpeed = 0;

    // Восстанавливаем гравитацию
    this.player.body.setAllowGravity(true);
    this.player.body.setGravityY(GRAVITY);

    // Принудительно обновляем физическое тело для применения гравитации
    this.player.body.updateFromGameObject();

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

  // Метод для сброса состояния перед перезапуском
  resetState() {
    this.scoreValue = 0;
    this.platformSpawnTimer = 0;
    this.wallSpawnTimer = 0; // Сбрасываем таймер стен
    this.isGameActive = true;
    this.jumpCount = 0; // Сбрасываем счетчик прыжков
    // Сбрасываем состояние переворота
    if (this.isFlipped) {
      this.unflipPlayer();
    }
    this.flipTimer = 0;
    this.boostTimer = 0;
    this.boostSpeed = 0;
  }

  update(time, delta) {
    if (!this.isGameActive) return;

    // Проверка: если персонаж достиг левого края canvas - проигрыш
    if (this.player.x <= 0) {
      this.hitObstacle();
      return;
    }

    // Минимальное время между генерацией платформы и стены (мс)
    const minTimeBetweenSpawns = 500;

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
      // Фиксируем скорость по Y на начальном значении
      this.player.setVelocity(
        currentVelocityX - boostChange,
        this.fixedVelocityY
      );

      if (this.boostTimer <= 0) {
        this.boostTimer = 0;
        this.boostSpeed = 0;
        // Убираем остаточное ускорение
        this.player.setVelocity(
          this.player.body.velocity.x - this.boostSpeed,
          this.fixedVelocityY
        );
      }
    } else if (this.boostTimer > 0 && !this.isFlipped) {
      // Если ускорение еще идет, но переворот закончился - просто обновляем скорость по X
      const previousBoostSpeed = this.boostSpeed;
      this.boostTimer -= delta;
      const boostProgress = Math.max(0, this.boostTimer / 1000);
      this.boostSpeed = 300 * boostProgress;
      const boostChange = previousBoostSpeed - this.boostSpeed;
      const currentVelocityX = this.player.body.velocity.x;
      this.player.setVelocityX(currentVelocityX - boostChange);

      if (this.boostTimer <= 0) {
        this.boostTimer = 0;
        this.boostSpeed = 0;
        this.player.setVelocityX(this.player.body.velocity.x - this.boostSpeed);
      }
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

    // Сбрасываем счетчик прыжков при приземлении
    if (
      this.player &&
      (this.player.body.touching.down || this.player.body.onFloor())
    ) {
      this.jumpCount = 0;
    }

    const { width, height } = this.scale;
    const groundY = height * 0.6;

    // Создание платформ
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
        // Слишком близко к генерации платформы, пропускаем создание стены
        this.wallSpawnTimer = 0;
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

    const config = {
      type: Phaser.AUTO,
      width: gameRef.current.clientWidth,
      height: gameRef.current.clientHeight,
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
        {!isGameStarted ? (
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
