/**
 * User Settings Utility
 * Manages user preferences stored in localStorage
 */

const SETTINGS_KEY = 'userSettings';

const defaultSettings = {
  notifications: true,
  readReceipts: true,
  securityAlerts: true,
  biometric: false,
};

/**
 * Get all user settings
 * @returns {Object} User settings object
 */
export function getUserSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load user settings:', error);
  }
  return defaultSettings;
}

/**
 * Update a specific setting
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 */
export function updateSetting(key, value) {
  try {
    const settings = getUserSettings();
    settings[key] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  } catch (error) {
    console.error('Failed to update setting:', error);
    throw error;
  }
}

/**
 * Update multiple settings at once
 * @param {Object} updates - Object with setting key-value pairs
 */
export function updateSettings(updates) {
  try {
    const settings = getUserSettings();
    Object.assign(settings, updates);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  } catch (error) {
    console.error('Failed to update settings:', error);
    throw error;
  }
}

/**
 * Reset all settings to defaults
 */
export function resetSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
    return defaultSettings;
  } catch (error) {
    console.error('Failed to reset settings:', error);
    throw error;
  }
}

