import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(__dirname, '..', 'storage');
const CONFIG_PATH = path.join(CONFIG_DIR, 'configs.json');

export function loadConfigs() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    console.error('Failed to load configs:', e);
    return {};
  }
}

export function saveConfigs(configs) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(configs, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save configs:', e);
  }
}
