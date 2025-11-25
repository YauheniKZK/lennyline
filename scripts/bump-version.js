#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Читаем package.json
const packagePath = resolve(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

// Парсим текущую версию
const versionParts = packageJson.version.split('.').map(Number);
let [major, minor, patch] = versionParts;

// Увеличиваем patch версию
patch += 1;

// Формируем новую версию
const newVersion = `${major}.${minor}.${patch}`;

// Обновляем версию в package.json
packageJson.version = newVersion;

// Записываем обратно
writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');

console.log(`Version bumped from ${versionParts.join('.')} to ${newVersion}`);

