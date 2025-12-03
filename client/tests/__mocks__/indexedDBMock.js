/**
 * IndexedDB Mock for Node.js Tests
 * Provides in-memory storage simulating IndexedDB behavior
 */

class IndexedDBMock {
  constructor() {
    this.databases = new Map();
  }

  /**
   * Opens a database
   * @param {string} name - Database name
   * @param {number} version - Version number
   * @returns {Promise<IDBDatabase>} Database instance
   */
  async open(name, version = 1) {
    if (!this.databases.has(name)) {
      this.databases.set(name, {
        name,
        version,
        stores: new Map()
      });
    }
    return this.databases.get(name);
  }

  /**
   * Deletes a database
   * @param {string} name - Database name
   * @returns {Promise<void>}
   */
  async deleteDatabase(name) {
    this.databases.delete(name);
  }

  /**
   * Gets data from a store
   * @param {string} dbName - Database name
   * @param {string} storeName - Store name
   * @param {string} key - Key to get
   * @returns {Promise<any>} Value
   */
  async get(dbName, storeName, key) {
    const db = this.databases.get(dbName);
    if (!db) return undefined;
    const store = db.stores.get(storeName);
    if (!store) return undefined;
    return store.get(key);
  }

  /**
   * Sets data in a store
   * @param {string} dbName - Database name
   * @param {string} storeName - Store name
   * @param {string} key - Key
   * @param {any} value - Value
   * @returns {Promise<void>}
   */
  async set(dbName, storeName, key, value) {
    const db = this.databases.get(dbName);
    if (!db) {
      this.databases.set(dbName, {
        name: dbName,
        version: 1,
        stores: new Map()
      });
    }
    const actualDb = this.databases.get(dbName);
    if (!actualDb.stores.has(storeName)) {
      actualDb.stores.set(storeName, new Map());
    }
    actualDb.stores.get(storeName).set(key, value);
  }

  /**
   * Deletes data from a store
   * @param {string} dbName - Database name
   * @param {string} storeName - Store name
   * @param {string} key - Key to delete
   * @returns {Promise<void>}
   */
  async delete(dbName, storeName, key) {
    const db = this.databases.get(dbName);
    if (!db) return;
    const store = db.stores.get(storeName);
    if (!store) return;
    store.delete(key);
  }

  /**
   * Clears all data
   */
  clear() {
    this.databases.clear();
  }
}

// Global mock instance
const mockDB = new IndexedDBMock();

// Export mock functions that can be used by sessionManager tests
export const mockIndexedDB = {
  open: async (name, version) => {
    return await mockDB.open(name, version);
  },
  get: async (dbName, storeName, key) => {
    return await mockDB.get(dbName, storeName, key);
  },
  set: async (dbName, storeName, key, value) => {
    return await mockDB.set(dbName, storeName, key, value);
  },
  delete: async (dbName, storeName, key) => {
    return await mockDB.delete(dbName, storeName, key);
  },
  clear: () => mockDB.clear()
};

export default mockDB;

