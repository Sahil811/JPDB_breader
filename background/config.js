// Common types shared across both content and background scripts
import { browser } from '../util.js';

export const CURRENT_SCHEMA_VERSION = 1;
export const defaultConfig = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  apiToken: null,
  showKanji: true,
  showHindi: false,
  showExamplesAutomatically: false,
  miningDeckId: null,
  forqDeckId: "forq",
  blacklistDeckId: "blacklist",
  neverForgetDeckId: "never-forget",
  contextWidth: 1,
  forqOnMine: true,
  customWordCSS: "",
  customPopupCSS: "",
  showPopupOnHover: false,
  touchscreenSupport: false,
  disableFadeAnimation: false,
  showPopupKey: { key: "Shift", code: "ShiftLeft", modifiers: [] },
  addKey: null,
  dialogKey: null,
  blacklistKey: null,
  neverForgetKey: null,
  nothingKey: null,
  somethingKey: null,
  hardKey: null,
  goodKey: null,
  easyKey: null,
  geminiApiKey: null,
};

// Cache for config
let configCache = null;

export function migrateSchema(config) {
  if (config.schemaVersion === 0) {
    // Keybinds changed from string to object
    // We don't have all the information required to turn them into objects
    // Just delete them and let users re-enter them
    for (const key of [
      "showPopupKey",
      "blacklistKey",
      "neverForgetKey",
      "nothingKey",
      "somethingKey",
      "hardKey",
      "goodKey",
      "easyKey",
    ]) {
      config[key] = defaultConfig[key];
    }
    config.schemaVersion = 1;
  }
}

export async function loadConfig() {
  if (configCache) return configCache;
  
  try {
    const result = await browser.storage.local.get(Object.keys(defaultConfig));
    const config = { ...defaultConfig };
    
    for (const [key, value] of Object.entries(result)) {
      if (value !== undefined) {
        config[key] = value;
      }
    }
    
    migrateSchema(config);
    
    // If the schema version is not the current version after applying all migrations, 
    // use the default as a fallback.
    if (config.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      configCache = defaultConfig;
      return defaultConfig;
    }
    
    configCache = config;
    return config;
  } catch (error) {
    console.error('Failed to load config:', error);
    return defaultConfig;
  }
}

export async function saveConfig(config) {
  try {
    await browser.storage.local.set(config);
    configCache = config;
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

// Synchronous version for backward compatibility (returns cached config)
export function getConfig() {
  return configCache || defaultConfig;
}
