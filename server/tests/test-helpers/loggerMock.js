/**
 * Logger Mock for Server Tests
 * Captures log entries in memory for assertions
 */

class LoggerMock {
  constructor() {
    this.logs = [];
    this.clear();
  }

  /**
   * Clears all captured logs
   */
  clear() {
    this.logs = [];
  }

  /**
   * Logs an entry
   * @param {string} level - Log level (info, warn, error)
   * @param {Object} entry - Log entry object
   */
  log(level, entry) {
    this.logs.push({
      level,
      timestamp: new Date().toISOString(),
      ...entry
    });
  }

  /**
   * Logs info entry
   * @param {Object} entry - Log entry
   */
  info(entry) {
    this.log('info', entry);
  }

  /**
   * Logs warning entry
   * @param {Object} entry - Log entry
   */
  warn(entry) {
    this.log('warn', entry);
  }

  /**
   * Logs error entry
   * @param {Object} entry - Log entry
   */
  error(entry) {
    this.log('error', entry);
  }

  /**
   * Gets all logs
   * @returns {Array} Array of log entries
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Gets logs by level
   * @param {string} level - Log level
   * @returns {Array} Filtered log entries
   */
  getLogsByLevel(level) {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Gets logs matching a predicate
   * @param {Function} predicate - Filter function
   * @returns {Array} Filtered log entries
   */
  getLogsMatching(predicate) {
    return this.logs.filter(predicate);
  }

  /**
   * Checks if any log contains text
   * @param {string} text - Text to search for
   * @returns {boolean} True if found
   */
  contains(text) {
    const logString = JSON.stringify(this.logs);
    return logString.includes(text);
  }
}

export default LoggerMock;

