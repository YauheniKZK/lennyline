import { useEffect, useRef, useState, useCallback } from "react";
import "./Game.css";
import GameMenu from "./GameMenu";
import packageJson from "../../package.json";

// Версия приложения (из package.json)
const APP_VERSION = packageJson.version;

// Класс частицы
class Particle {
  constructor(canvas, x, y, color) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    // Позиция
    this.x = x;
    this.y = y;

    // Скорость (случайное направление)
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    // Размер
    this.size = 2 + Math.random() * 3;

    // Цвет (берем из квадрата)
    this.color = color;

    // Время жизни
    this.life = 1.0; // От 1.0 до 0.0
    this.decay = 0.02 + Math.random() * 0.03; // Скорость исчезновения

    // Гравитация
    this.gravity = 0.15; // Увеличена для более быстрой анимации
  }

  update(deltaTime) {
    // Нормализуем deltaTime для 60 FPS (16.67ms на кадр)
    const normalizedDelta = deltaTime / 16.67;

    // Применяем гравитацию (независимо от FPS)
    this.vy += this.gravity * normalizedDelta;

    // Обновляем позицию (независимо от FPS)
    this.x += this.vx * normalizedDelta;
    this.y += this.vy * normalizedDelta;

    // Уменьшаем время жизни (независимо от FPS)
    this.life -= this.decay * normalizedDelta;

    // Замедляем частицы (независимо от FPS)
    const slowdownFactor = Math.pow(0.98, normalizedDelta);
    this.vx *= slowdownFactor;
    this.vy *= slowdownFactor;

    // Возвращаем true, если частица еще жива
    return this.life > 0;
  }

  draw() {
    // Прозрачность зависит от времени жизни
    const alpha = this.life;

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x, this.y, this.size, this.size);
    this.ctx.restore();
  }
}

// Менеджер частиц
class ParticleManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.particles = [];
  }

  // Создание частиц из квадрата
  createExplosion(x, y, color, count = 15) {
    // Оптимизация для мобильных: уменьшаем количество частиц
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    const particleCount = isMobile ? Math.min(count, 8) : count;

    for (let i = 0; i < particleCount; i++) {
      this.particles.push(new Particle(this.canvas, x, y, color));
    }
  }

  // Обновление всех частиц (deltaTime в миллисекундах)
  update(deltaTime) {
    // Оптимизация: используем цикл for вместо filter для лучшей производительности
    let writeIndex = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (particle.update(deltaTime)) {
        this.particles[writeIndex++] = particle;
      }
    }
    this.particles.length = writeIndex;
  }

  // Отрисовка всех частиц
  draw() {
    // Оптимизация: используем цикл for вместо forEach
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].draw();
    }
  }

  // Очистка всех частиц
  clear() {
    this.particles = [];
  }
}

// Класс квадрата
class Square {
  constructor(canvas, x, y, size = 20) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.size = size;

    // Позиция
    this.x = x;
    this.y = y;

    // Скорость (произвольная, увеличена для более быстрой анимации)
    this.vx = (Math.random() - 0.5) * 3; // от -1.5 до 1.5
    this.vy = (Math.random() - 0.5) * 3; // от -1.5 до 1.5

    // Цвет (случайный)
    this.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
  }

  // Обновление позиции (deltaTime в миллисекундах)
  update(squares, deltaTime) {
    // Нормализуем deltaTime для 60 FPS (16.67ms на кадр)
    const normalizedDelta = deltaTime / 16.67;

    // Обновляем позицию (скорость независима от FPS)
    this.x += this.vx * normalizedDelta;
    this.y += this.vy * normalizedDelta;

    // Отскок от краев canvas
    if (this.x <= 0 || this.x + this.size >= this.canvas.width) {
      this.vx = -this.vx;
      this.x = Math.max(0, Math.min(this.x, this.canvas.width - this.size));
    }

    if (this.y <= 0 || this.y + this.size >= this.canvas.height) {
      this.vy = -this.vy;
      this.y = Math.max(0, Math.min(this.y, this.canvas.height - this.size));
    }

    // Оптимизация: проверяем столкновения только с близкими квадратами
    // Для каждого квадрата проверяем только те, которые еще не проверяли друг с другом
    const thisIndex = squares.indexOf(this);
    for (let i = thisIndex + 1; i < squares.length; i++) {
      const other = squares[i];
      if (other !== this) {
        // Быстрая проверка расстояния перед детальной проверкой
        const dx = Math.abs(
          this.x + this.size / 2 - (other.x + other.size / 2)
        );
        const dy = Math.abs(
          this.y + this.size / 2 - (other.y + other.size / 2)
        );
        const minDist = (this.size + other.size) / 2;

        if (dx < minDist * 1.5 && dy < minDist * 1.5) {
          this.checkCollision(other);
        }
      }
    }
  }

  // Получить ID квадрата (для отслеживания)
  getId() {
    return `square_${this.x}_${this.y}_${this.size}`;
  }

  // Проверка столкновения с другим квадратом (AABB - Axis-Aligned Bounding Box)
  checkCollision(other) {
    // Проверка пересечения прямоугольников
    const thisLeft = this.x;
    const thisRight = this.x + this.size;
    const thisTop = this.y;
    const thisBottom = this.y + this.size;

    const otherLeft = other.x;
    const otherRight = other.x + other.size;
    const otherTop = other.y;
    const otherBottom = other.y + other.size;

    // Проверяем пересечение
    if (
      thisRight > otherLeft &&
      thisLeft < otherRight &&
      thisBottom > otherTop &&
      thisTop < otherBottom
    ) {
      // Вычисляем перекрытие по каждой оси
      const overlapX = Math.min(thisRight - otherLeft, otherRight - thisLeft);
      const overlapY = Math.min(thisBottom - otherTop, otherBottom - thisTop);

      // Определяем направление столкновения (наименьшее перекрытие = основная ось столкновения)
      if (overlapX < overlapY) {
        // Столкновение по горизонтали
        if (this.vx - other.vx !== 0) {
          // Обмениваемся горизонтальными скоростями
          const tempVx = this.vx;
          this.vx = other.vx;
          other.vx = tempVx;
        }

        // Разделяем квадраты
        const separation = overlapX / 2;
        if (this.x < other.x) {
          this.x -= separation;
          other.x += separation;
        } else {
          this.x += separation;
          other.x -= separation;
        }

        // Финальная корректировка позиций
        const finalOverlapX = Math.max(
          0,
          Math.min(this.x + this.size, other.x + other.size) -
            Math.max(this.x, other.x)
        );
        if (finalOverlapX > 0) {
          const fix = finalOverlapX / 2 + 0.1; // Добавляем небольшой зазор
          if (this.x < other.x) {
            this.x -= fix;
            other.x += fix;
          } else {
            this.x += fix;
            other.x -= fix;
          }
        }
      } else {
        // Столкновение по вертикали
        if (this.vy - other.vy !== 0) {
          // Обмениваемся вертикальными скоростями
          const tempVy = this.vy;
          this.vy = other.vy;
          other.vy = tempVy;
        }

        // Разделяем квадраты
        const separation = overlapY / 2;
        if (this.y < other.y) {
          this.y -= separation;
          other.y += separation;
        } else {
          this.y += separation;
          other.y -= separation;
        }

        // Финальная корректировка позиций
        const finalOverlapY = Math.max(
          0,
          Math.min(this.y + this.size, other.y + other.size) -
            Math.max(this.y, other.y)
        );
        if (finalOverlapY > 0) {
          const fix = finalOverlapY / 2 + 0.1; // Добавляем небольшой зазор
          if (this.y < other.y) {
            this.y -= fix;
            other.y += fix;
          } else {
            this.y += fix;
            other.y -= fix;
          }
        }
      }

      // Дополнительная проверка: если все еще есть пересечение, принудительно разделяем
      const stillOverlappingX =
        Math.min(this.x + this.size, other.x + other.size) -
        Math.max(this.x, other.x);
      const stillOverlappingY =
        Math.min(this.y + this.size, other.y + other.size) -
        Math.max(this.y, other.y);

      if (stillOverlappingX > 0 && stillOverlappingY > 0) {
        // Принудительное разделение по центру
        const centerX1 = this.x + this.size / 2;
        const centerX2 = other.x + other.size / 2;
        const centerY1 = this.y + this.size / 2;
        const centerY2 = other.y + other.size / 2;

        const dx = centerX2 - centerX1;
        const dy = centerY2 - centerY1;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          const minDist = (this.size + other.size) / 2 + 1;
          const separationX = ((dx / distance) * (minDist - distance)) / 2;
          const separationY = ((dy / distance) * (minDist - distance)) / 2;

          this.x -= separationX;
          this.y -= separationY;
          other.x += separationX;
          other.y += separationY;
        }
      }
    }
  }

  draw() {
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x, this.y, this.size, this.size);
  }

  // Обновление при изменении размера canvas
  updateCanvasSize() {
    // Если квадрат вышел за границы, перемещаем его
    if (this.x + this.size > this.canvas.width) {
      this.x = this.canvas.width - this.size;
    }
    if (this.y + this.size > this.canvas.height) {
      this.y = this.canvas.height - this.size;
    }
  }
}

// Генератор квадратов
class SquareGenerator {
  constructor(canvas, maxSquares = 5) {
    this.canvas = canvas;
    this.maxSquares = maxSquares;
    this.squares = [];
  }

  // Генерация нового квадрата
  generate() {
    if (this.squares.length >= this.maxSquares) {
      return; // Не создаем больше максимума
    }

    const size = 20 + Math.random() * 20; // От 20 до 40px
    const x = Math.random() * (this.canvas.width - size);
    const y = Math.random() * (this.canvas.height - size);

    // Проверяем, не пересекается ли новый квадрат с существующими
    let canPlace = true;
    for (const square of this.squares) {
      const dx = x + size / 2 - (square.x + square.size / 2);
      const dy = y + size / 2 - (square.y + square.size / 2);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = size / 2 + square.size / 2;

      if (distance < minDistance * 1.5) {
        canPlace = false;
        break;
      }
    }

    if (canPlace) {
      this.squares.push(new Square(this.canvas, x, y, size));
    }
  }

  // Обновление всех квадратов (deltaTime в миллисекундах)
  update(deltaTime) {
    // Оптимизация: обновляем квадраты в одном цикле
    for (let i = 0; i < this.squares.length; i++) {
      this.squares[i].update(this.squares, deltaTime);
    }

    // Догенерируем квадраты, если их осталось меньше 3
    if (this.squares.length < 3) {
      const needed = this.maxSquares - this.squares.length;
      for (let i = 0; i < needed; i++) {
        this.generate();
      }
    }
  }

  // Отрисовка всех квадратов
  draw() {
    // Оптимизация: используем цикл for вместо forEach
    for (let i = 0; i < this.squares.length; i++) {
      this.squares[i].draw();
    }
  }

  // Очистка всех квадратов
  clear() {
    this.squares = [];
  }

  // Обновление при изменении размера canvas
  updateCanvasSize() {
    this.squares.forEach((square) => {
      square.updateCanvasSize();
    });
  }

  // Получить количество квадратов
  getCount() {
    return this.squares.length;
  }

  // Проверка столкновений с персонажем и удаление квадратов
  checkPlayerCollision(player, particleManager) {
    const playerLeft = player.x;
    const playerRight = player.x + player.width;
    const playerTop = player.y;
    const playerBottom = player.y + player.height;

    // Проверяем каждый квадрат на столкновение с персонажем
    this.squares = this.squares.filter((square) => {
      const squareLeft = square.x;
      const squareRight = square.x + square.size;
      const squareTop = square.y;
      const squareBottom = square.y + square.size;

      // Проверяем пересечение
      const isColliding =
        playerRight > squareLeft &&
        playerLeft < squareRight &&
        playerBottom > squareTop &&
        playerTop < squareBottom;

      if (isColliding) {
        // Создаем частицы в центре квадрата
        const centerX = square.x + square.size / 2;
        const centerY = square.y + square.size / 2;
        particleManager.createExplosion(centerX, centerY, square.color);

        // Пополняем здоровье в зависимости от размера квадрата
        // Больший квадрат = больше здоровья (размер от 20 до 40px)
        const healthAmount = Math.round(square.size / 10); // От 2 до 4 здоровья
        player.addHealth(healthAmount);

        return false; // Удаляем квадрат
      }

      return true; // Оставляем квадрат
    });
  }
}

// Класс препятствия (линия с дыркой)
class Obstacle {
  constructor(canvas, y, holeSize, holeSpeed, verticalSpeed, lineWidth = 3) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    // Уникальный ID препятствия
    this.id = Math.random().toString(36).substr(2, 9);

    // Позиция линии (y координата)
    this.y = y;

    // Размер дырки
    this.holeSize = holeSize;

    // Позиция центра дырки (x координата)
    this.holeX = canvas.width / 2;

    // Скорость движения дырки влево-вправо
    this.holeSpeed = holeSpeed;
    this.holeDirection = Math.random() > 0.5 ? 1 : -1; // Направление движения дырки

    // Скорость движения линии сверху вниз
    this.verticalSpeed = verticalSpeed;

    // Ширина линии
    this.lineWidth = lineWidth;

    // Цвет линии
    this.color = "#333333";
  }

  // Обновление позиции (deltaTime в миллисекундах)
  update(deltaTime) {
    // Нормализуем deltaTime для 60 FPS (16.67ms на кадр)
    const normalizedDelta = deltaTime / 16.67;

    // Двигаем линию вниз (скорость независима от FPS)
    this.y += this.verticalSpeed * normalizedDelta;

    // Двигаем дырку влево-вправо (скорость независима от FPS)
    this.holeX += this.holeSpeed * this.holeDirection * normalizedDelta;

    // Отскок дырки от краев
    const halfHole = this.holeSize / 2;
    if (this.holeX - halfHole <= 0) {
      this.holeX = halfHole;
      this.holeDirection = 1;
    } else if (this.holeX + halfHole >= this.canvas.width) {
      this.holeX = this.canvas.width - halfHole;
      this.holeDirection = -1;
    }
  }

  // Получить ID препятствия (для отслеживания)
  getId() {
    return this.id;
  }

  // Проверка столкновения с персонажем (возвращает true если есть столкновение, false если нет)
  checkCollision(player) {
    // Проверяем, находится ли персонаж на уровне линии
    const playerTop = player.y;
    const playerBottom = player.y + player.height;
    const lineTop = this.y - this.lineWidth / 2;
    const lineBottom = this.y + this.lineWidth / 2;

    // Если персонаж пересекается с линией по вертикали
    if (playerBottom > lineTop && playerTop < lineBottom) {
      // Проверяем, находится ли персонаж полностью в дырке
      const playerLeft = player.x;
      const playerRight = player.x + player.width;
      const holeLeft = this.holeX - this.holeSize / 2;
      const holeRight = this.holeX + this.holeSize / 2;

      // Персонаж должен быть полностью в дырке, иначе столкновение
      // Проверяем, что оба края персонажа находятся внутри дырки
      const isFullyInHole =
        playerLeft >= holeLeft &&
        playerRight <= holeRight &&
        playerLeft < holeRight &&
        playerRight > holeLeft;

      if (!isFullyInHole) {
        return true; // Столкновение с линией
      }
    }

    return false; // Нет столкновения
  }

  // Отрисовка линии с дыркой
  draw() {
    this.ctx.save();
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = this.lineWidth;
    this.ctx.lineCap = "square";

    // Рисуем левую часть линии
    if (this.holeX - this.holeSize / 2 > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, this.y);
      this.ctx.lineTo(this.holeX - this.holeSize / 2, this.y);
      this.ctx.stroke();
    }

    // Рисуем правую часть линии
    if (this.holeX + this.holeSize / 2 < this.canvas.width) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.holeX + this.holeSize / 2, this.y);
      this.ctx.lineTo(this.canvas.width, this.y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  // Проверка, вышла ли линия за пределы экрана
  isOffScreen() {
    return this.y > this.canvas.height;
  }
}

// Генератор препятствий
class ObstacleGenerator {
  constructor(canvas, config = {}) {
    this.canvas = canvas;

    // Настройки по умолчанию
    this.config = {
      spawnInterval: config.spawnInterval || 2000, // Частота генерации (мс)
      verticalSpeed: config.verticalSpeed || 2, // Скорость движения сверху вниз
      holeSpeed: config.holeSpeed || 1, // Скорость движения дырок
      holeSizeMin: config.holeSizeMin || 40, // Минимальный размер дырки
      holeSizeMax: config.holeSizeMax || 80, // Максимальный размер дырки
      lineWidth: config.lineWidth || 3, // Ширина линии
    };

    this.obstacles = [];
    this.lastSpawnTime = 0;
    this.lastUpdateTime = 0;
    this.passedObstacles = new Set(); // Множество пройденных препятствий (чтобы не засчитывать дважды)
  }

  // Обновление
  update(currentTime, deltaTime) {
    // Генерируем новые препятствия
    if (currentTime - this.lastSpawnTime >= this.config.spawnInterval) {
      this.spawn();
      this.lastSpawnTime = currentTime;
    }

    // Обновляем существующие препятствия с deltaTime
    this.obstacles.forEach((obstacle) => {
      obstacle.update(deltaTime);
    });

    // Удаляем препятствия, вышедшие за экран
    const removedObstacles = this.obstacles.filter((obstacle) =>
      obstacle.isOffScreen()
    );

    // Удаляем ID удаленных препятствий из passedObstacles
    removedObstacles.forEach((obstacle) => {
      this.passedObstacles.delete(obstacle.getId());
    });

    this.obstacles = this.obstacles.filter(
      (obstacle) => !obstacle.isOffScreen()
    );
  }

  // Генерация нового препятствия
  spawn() {
    const holeSize =
      this.config.holeSizeMin +
      Math.random() * (this.config.holeSizeMax - this.config.holeSizeMin);

    const obstacle = new Obstacle(
      this.canvas,
      -this.config.lineWidth, // Начинаем немного выше экрана
      holeSize,
      this.config.holeSpeed,
      this.config.verticalSpeed,
      this.config.lineWidth
    );

    this.obstacles.push(obstacle);
  }

  // Подсчет пройденных препятствий (возвращает количество новых пройденных)
  countPassedObstacles(player) {
    let newPassedCount = 0;
    const playerBottom = player.y + player.height;

    for (const obstacle of this.obstacles) {
      const obstacleId = obstacle.getId();

      // Если препятствие прошло ниже персонажа и еще не было засчитано
      if (obstacle.y > playerBottom && !this.passedObstacles.has(obstacleId)) {
        this.passedObstacles.add(obstacleId);
        newPassedCount++;
      }
    }

    return newPassedCount;
  }

  // Проверка столкновений с персонажем (возвращает true если здоровье <= 0 после получения урона)
  checkPlayerCollision(player) {
    const currentObstacleIds = new Set();
    let tookDamage = false;

    for (const obstacle of this.obstacles) {
      const obstacleId = obstacle.getId();

      if (obstacle.checkCollision(player)) {
        // Персонаж в столкновении с этой линией
        currentObstacleIds.add(obstacleId);

        // Если персонаж еще не был в этом препятствии - наносим урон
        if (!player.currentObstacles.has(obstacleId)) {
          player.takeDamage(player.damagePerLine);
          tookDamage = true;
        }
      }
    }

    // Обновляем отслеживание препятствий - убираем те, из которых персонаж вышел
    player.currentObstacles.forEach((id) => {
      if (!currentObstacleIds.has(id)) {
        player.currentObstacles.delete(id); // Персонаж вышел из этого препятствия
      }
    });

    // Добавляем новые препятствия
    currentObstacleIds.forEach((id) => {
      player.currentObstacles.add(id);
    });

    // Проверяем здоровье только если был получен урон
    // Игра заканчивается только если здоровье <= 0 ПОСЛЕ получения урона
    if (tookDamage && player.isDead()) {
      return true;
    }

    return false;
  }

  // Отрисовка всех препятствий
  draw() {
    // Оптимизация: используем цикл for вместо forEach
    for (let i = 0; i < this.obstacles.length; i++) {
      this.obstacles[i].draw();
    }
  }

  // Очистка всех препятствий
  clear() {
    this.obstacles = [];
    this.lastSpawnTime = 0;
    this.passedObstacles.clear();
  }
}

// Класс персонажа
class Player {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    // Размеры персонажа (фиксированные)
    this.width = 10; // 10px
    this.height = 30; // 30px

    // Позиция: внизу по центру
    this.x = canvas.width / 2 - this.width / 2;
    // Начальная позиция: 10% от нижнего края canvas
    this.initialY = canvas.height - canvas.height * 0.1 - this.height;
    this.y = this.initialY;

    // Физика (увеличена для более быстрой и плавной анимации)
    this.velocityY = 0.5; // Вертикальная скорость
    this.gravity = 0.2; // Гравитация (увеличена)
    this.jumpForce = -3; // Сила прыжка (отрицательное значение = вверх, увеличена)
    // Земля: нижний край canvas
    this.groundY = canvas.height - this.height;
    this.wasInAir = false; // Флаг: был ли персонаж в воздухе

    // Здоровье
    this.health = 0; // Изначально здоровья нет
    this.damagePerLine = 1; // Урон от одной линии при соприкосновении

    // Отслеживание столкновений с линиями (чтобы не наносить повторный урон)
    this.currentObstacles = new Set(); // ID препятствий, в которых сейчас находится персонаж

    // Анимация сотрясения
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeIntensity = 0;
    this.shakeDecay = 0.9; // Скорость затухания тряски

    // Цвет персонажа
    this.color = "#3390ec";
  }

  // Сброс персонажа в начальную позицию
  reset() {
    this.y = this.initialY;
    this.velocityY = 0;
    // Земля всегда на нижнем краю canvas
    this.groundY = this.canvas.height - this.height;
    this.wasInAir = false;
    this.health = 0; // Сбрасываем здоровье
    this.currentObstacles.clear(); // Очищаем отслеживание препятствий
    // Сбрасываем анимацию сотрясения
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  // Пополнение здоровья
  addHealth(amount) {
    this.health += amount;
  }

  // Получение урона
  takeDamage(amount) {
    this.health -= amount;
    // Запускаем анимацию сотрясения
    this.startShake(10); // Интенсивность тряски
    return this.health <= 0; // Возвращает true, если здоровье <= 0
  }

  // Запуск анимации сотрясения
  startShake(intensity) {
    this.shakeIntensity = intensity;
  }

  // Обновление анимации сотрясения
  updateShake() {
    if (this.shakeIntensity > 0) {
      // Генерируем случайное смещение
      this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity;

      // Уменьшаем интенсивность
      this.shakeIntensity *= this.shakeDecay;

      // Если интенсивность стала очень маленькой, останавливаем тряску
      if (this.shakeIntensity < 0.1) {
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    }
  }

  // Проверка здоровья
  isDead() {
    return this.health < 0; // Здоровье должно быть отрицательным для смерти
  }

  // Прыжок
  jump() {
    this.velocityY = this.jumpForce;
    this.wasInAir = true; // Отмечаем, что персонаж был в воздухе
  }

  // Обновление позиции (deltaTime в миллисекундах)
  update(deltaTime) {
    // Обновляем анимацию сотрясения
    this.updateShake();

    // Если персонаж не был в воздухе (еще не прыгал), не обновляем - персонаж остается на месте
    if (!this.wasInAir) {
      return false;
    }

    // Нормализуем deltaTime для 60 FPS (16.67ms на кадр)
    const normalizedDelta = deltaTime / 16.67;

    // Применяем гравитацию (независимо от FPS)
    this.velocityY += this.gravity * normalizedDelta;

    // Обновляем позицию (независимо от FPS)
    this.y += this.velocityY * normalizedDelta;

    // Проверяем столкновение с землей
    if (this.y >= this.groundY) {
      this.y = this.groundY;
      this.velocityY = 0;
      // Столкновение с землей всегда заканчивает игру
      if (this.wasInAir) {
        return "ground"; // Возвращаем "ground" если коснулись земли после прыжка
      }
    }

    return false;
  }

  // Проверка столкновения с низом
  checkGroundCollision() {
    return this.y >= this.groundY;
  }

  draw() {
    // Применяем смещение от тряски к позиции отрисовки
    const drawX = this.x + this.shakeOffsetX;
    const drawY = this.y + this.shakeOffsetY;

    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(drawX, drawY, this.width, this.height);
  }

  // Обновление позиции при изменении размера canvas
  updatePosition() {
    // Размеры фиксированные, обновляем только позицию
    this.x = this.canvas.width / 2 - this.width / 2;
    // Начальная позиция: 10% от нижнего края canvas
    this.initialY = this.canvas.height - this.canvas.height * 0.1 - this.height;
    // Земля: нижний край canvas
    this.groundY = this.canvas.height - this.height;
    // Если персонаж на земле или не был в воздухе, устанавливаем начальную позицию
    if (this.y >= this.groundY || !this.wasInAir) {
      this.y = this.initialY;
    }
  }
}

function Game() {
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const squareGeneratorRef = useRef(null);
  const particleManagerRef = useRef(null);
  const obstacleGeneratorRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isGameStartedRef = useRef(false);
  const isGameOverRef = useRef(false);
  const gameTimeRef = useRef(0);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(0);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  // Синхронизируем refs с состояниями
  useEffect(() => {
    isGameStartedRef.current = isGameStarted;
  }, [isGameStarted]);

  useEffect(() => {
    isGameOverRef.current = isGameOver;
  }, [isGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Фиксированное внутреннее разрешение игры (логические единицы)
    const GAME_WIDTH = 375; // Ширина игры в логических пикселях
    const GAME_HEIGHT = 667; // Высота игры в логических пикселях (соотношение iPhone)

    // Установка размеров canvas с нормализацией
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Вычисляем масштаб для сохранения пропорций
      const scaleX = containerWidth / GAME_WIDTH;
      const scaleY = containerHeight / GAME_HEIGHT;
      const scale = Math.min(scaleX, scaleY); // Берем меньший масштаб для сохранения пропорций

      // Устанавливаем размеры canvas (внутреннее разрешение игры)
      canvas.width = GAME_WIDTH;
      canvas.height = GAME_HEIGHT;

      // Масштабируем отображение CSS для нормализации
      const scaledWidth = GAME_WIDTH * scale;
      const scaledHeight = GAME_HEIGHT * scale;
      canvas.style.width = `${scaledWidth}px`;
      canvas.style.height = `${scaledHeight}px`;
      canvas.style.imageRendering = "pixelated"; // Четкое отображение пикселей

      // Обновляем позицию персонажа при изменении размера
      if (playerRef.current) {
        playerRef.current.updatePosition();
      }
      // Обновляем квадраты при изменении размера
      if (squareGeneratorRef.current) {
        squareGeneratorRef.current.updateCanvasSize();
      }
    };

    // Сначала устанавливаем размеры canvas
    resizeCanvas();

    // Затем инициализируем персонажа (после того как canvas имеет правильные размеры)
    if (!playerRef.current) {
      playerRef.current = new Player(canvas);
      // После создания персонажа еще раз обновляем позицию
      playerRef.current.updatePosition();
    }

    // Инициализируем генератор квадратов
    if (!squareGeneratorRef.current) {
      squareGeneratorRef.current = new SquareGenerator(canvas, 5);
      // Генерируем начальные квадраты
      for (let i = 0; i < 5; i++) {
        squareGeneratorRef.current.generate();
      }
    }

    // Инициализируем менеджер частиц
    if (!particleManagerRef.current) {
      particleManagerRef.current = new ParticleManager(canvas);
    }

    // Инициализируем генератор препятствий
    if (!obstacleGeneratorRef.current) {
      obstacleGeneratorRef.current = new ObstacleGenerator(canvas, {
        spawnInterval: 6000, // Генерируем новую линию каждые 3 секунды
        verticalSpeed: 0.5, // Скорость движения сверху вниз (увеличена)
        holeSpeed: 1.2, // Скорость движения дырок (увеличена)
        holeSizeMin: 40, // Минимальный размер дырки
        holeSizeMax: 80, // Максимальный размер дырки
        lineWidth: 3, // Ширина линии
      });
    }

    // Обработка изменения размера окна
    window.addEventListener("resize", resizeCanvas);

    // Оптимизация для мобильных устройств
    let lastHealthUpdate = 0;
    const HEALTH_UPDATE_INTERVAL = 100; // Обновляем здоровье не чаще раз в 100мс
    let cachedHealth = 0;

    // Для расчета deltaTime
    let lastFrameTime = performance.now();

    // Оптимизация canvas для мобильных устройств
    ctx.imageSmoothingEnabled = true; // Включаем сглаживание для более плавной анимации
    ctx.imageSmoothingQuality = "high"; // Высокое качество сглаживания

    // Функция отрисовки
    const render = () => {
      const currentTime = performance.now();

      // Вычисляем deltaTime (время между кадрами в миллисекундах)
      let deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      // Ограничиваем deltaTime для предотвращения больших скачков
      // (например, когда вкладка была неактивна)
      if (deltaTime > 100) {
        deltaTime = 100; // Максимум 100мс (10 FPS минимум)
      }
      if (deltaTime < 1) {
        deltaTime = 1; // Минимум 1мс
      }

      // Очистка canvas и заливка белым фоном
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Обновление препятствий (только если игра запущена)
      if (
        obstacleGeneratorRef.current &&
        isGameStartedRef.current &&
        !isGameOverRef.current
      ) {
        // Обновляем время игры только когда игра запущена
        gameTimeRef.current = currentTime;
        obstacleGeneratorRef.current.update(currentTime, deltaTime);

        // Подсчитываем пройденные препятствия и увеличиваем счет
        if (playerRef.current) {
          const passedCount = obstacleGeneratorRef.current.countPassedObstacles(
            playerRef.current
          );
          if (passedCount > 0) {
            setScore((prev) => prev + passedCount);
          }
        }
      }

      // Обновление и отрисовка персонажа (только если игра запущена)
      if (
        playerRef.current &&
        isGameStartedRef.current &&
        !isGameOverRef.current
      ) {
        const hitGround = playerRef.current.update(deltaTime);
        // Столкновение с землей всегда заканчивает игру
        if (hitGround === "ground") {
          setIsGameOver(true);
          setIsGameStarted(false);
        }

        // Проверка столкновений с препятствиями
        if (obstacleGeneratorRef.current) {
          const isDead = obstacleGeneratorRef.current.checkPlayerCollision(
            playerRef.current
          );
          // Игра заканчивается если здоровье < 0
          if (isDead) {
            setIsGameOver(true);
            setIsGameStarted(false);
          }
        }
      }

      // Обновление квадратов (всегда, даже если игра не запущена)
      if (squareGeneratorRef.current) {
        squareGeneratorRef.current.update(deltaTime);
      }

      // Проверка столкновений персонажа с квадратами (только если игра запущена)
      if (
        playerRef.current &&
        squareGeneratorRef.current &&
        particleManagerRef.current &&
        isGameStartedRef.current &&
        !isGameOverRef.current
      ) {
        squareGeneratorRef.current.checkPlayerCollision(
          playerRef.current,
          particleManagerRef.current
        );
      }

      // Оптимизированное обновление здоровья (не чаще чем раз в HEALTH_UPDATE_INTERVAL мс)
      if (
        playerRef.current &&
        isGameStartedRef.current &&
        !isGameOverRef.current &&
        currentTime - lastHealthUpdate >= HEALTH_UPDATE_INTERVAL
      ) {
        const newHealth = playerRef.current.health;
        if (newHealth !== cachedHealth) {
          cachedHealth = newHealth;
          setHealth(newHealth);
          lastHealthUpdate = currentTime;
        }
      }

      // Обновление частиц
      if (particleManagerRef.current) {
        particleManagerRef.current.update(deltaTime);
      }

      // Отрисовка препятствий (внизу, под всем)
      if (
        obstacleGeneratorRef.current &&
        isGameStartedRef.current &&
        !isGameOverRef.current
      ) {
        obstacleGeneratorRef.current.draw();
      }

      // Отрисовка квадратов (до персонажа, чтобы персонаж был сверху)
      if (squareGeneratorRef.current) {
        squareGeneratorRef.current.draw();
      }

      // Отрисовка частиц (под персонажем, но над квадратами)
      if (particleManagerRef.current) {
        particleManagerRef.current.draw();
      }

      // Отрисовка персонажа (сверху всех)
      if (playerRef.current) {
        playerRef.current.draw();
      }

      // Продолжаем анимацию
      animationFrameRef.current = requestAnimationFrame(render);
    };

    // Запуск анимации
    render();

    // Очистка при размонтировании
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Оптимизированная функция прыжка (мемоизирована)
  const performJump = useCallback(() => {
    // Мгновенная реакция без requestAnimationFrame для максимальной отзывчивости
    if (
      playerRef.current &&
      isGameStartedRef.current &&
      !isGameOverRef.current
    ) {
      playerRef.current.jump();
    }
  }, []);

  // Обработчик кликов (для десктопа и мыши) - оптимизирован
  const handleTap = useCallback(
    (e) => {
      // Если клик по меню или кнопке - игнорируем
      if (
        e.target.closest(".game-menu") ||
        e.target.closest(".game-menu-button")
      ) {
        return;
      }
      if (!isGameStarted || isGameOver) return;
      performJump();
    },
    [isGameStarted, isGameOver, performJump]
  );

  // Обработчик touch событий для мультитач (оптимизированный)
  const handleTouchStart = useCallback(
    (e) => {
      // Если касание по меню или кнопке - не предотвращаем стандартное поведение
      if (
        e.target.closest(".game-menu") ||
        e.target.closest(".game-menu-button")
      ) {
        return;
      }

      if (!isGameStarted || isGameOver) return;

      // Предотвращаем стандартное поведение (скролл, масштаб) для лучшей отзывчивости
      e.preventDefault();

      // Обрабатываем каждое касание (мультитач) - каждое касание = прыжок
      // Используем e.changedTouches для получения всех новых касаний
      const touches = e.changedTouches;
      for (let i = 0; i < touches.length; i++) {
        performJump();
      }
    },
    [isGameStarted, isGameOver, performJump]
  );

  // Обработчик для предотвращения скролла и масштабирования
  const handleTouchMove = useCallback((e) => {
    // Предотвращаем скролл и масштаб
    e.preventDefault();
  }, []);

  // Обработчик для предотвращения стандартного поведения при окончании касания
  const handleTouchEnd = useCallback((e) => {
    // Если касание по меню или кнопке - не предотвращаем стандартное поведение
    if (
      e.target.closest(".game-menu") ||
      e.target.closest(".game-menu-button")
    ) {
      return;
    }
    e.preventDefault();
  }, []);

  const handleStart = () => {
    if (playerRef.current) {
      playerRef.current.reset();
      setHealth(playerRef.current.health); // Сбрасываем отображение здоровья
    }
    // Очищаем и генерируем новые квадраты при старте игры
    if (squareGeneratorRef.current) {
      squareGeneratorRef.current.clear();
      for (let i = 0; i < 5; i++) {
        squareGeneratorRef.current.generate();
      }
    }
    // Очищаем частицы
    if (particleManagerRef.current) {
      particleManagerRef.current.clear();
    }
    // Очищаем препятствия
    if (obstacleGeneratorRef.current) {
      obstacleGeneratorRef.current.clear();
    }
    // Сбрасываем время игры
    gameTimeRef.current = 0;
    setIsGameOver(false);
    setIsGameStarted(true);
    setScore(0);
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-title-section">
          <h2 className="game-title">LennyLine</h2>
          <span className="game-version">v{APP_VERSION}</span>
        </div>
        <div className="game-stats">
          <div className="health">Здоровье: {health}</div>
          <div className="score">Счет: {score}</div>
        </div>
      </div>

      <div
        className="game-area"
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} className="game-canvas" />
        {(!isGameStarted || isGameOver) && <GameMenu onStart={handleStart} />}
      </div>
    </div>
  );
}

export default Game;
