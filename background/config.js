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

export async function loadConfig(forceReload = false) {
  if (configCache && !forceReload) return configCache;
  
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
      configCache = Object.freeze(defaultConfig);
      return configCache;
    }
    
    configCache = Object.freeze(config);
    return configCache;
  } catch (error) {
    console.error('Failed to load config:', error);
    return Object.freeze(defaultConfig);
  }
}

export async function saveConfig(newConfig) {
  try {
    const frozenConfig = Object.freeze({ ...newConfig });
    await browser.storage.local.set(frozenConfig);
    configCache = frozenConfig;
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

// Synchronous version for backward compatibility (returns cached config)
export function getConfig() {
  return configCache || defaultConfig;
}
