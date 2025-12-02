/**
 * IndexedDB Mock Helper
 * Provides utilities for testing IndexedDB operations
 * Note: This is a placeholder - actual IndexedDB testing should use fake-indexeddb
 * or browser-based testing environment
 */

/**
 * Sets up IndexedDB mock (placeholder)
 * In a real browser environment, this would use the actual IndexedDB API
 * For Node.js tests, this would use fake-indexeddb
 */
export function setupIndexedDBMock() {
  // In browser environment, IndexedDB is available globally
  // In Node.js, we'd need to use fake-indexeddb
  if (typeof indexedDB === 'undefined') {
    console.warn('IndexedDB not available in this environment. Use fake-indexeddb for Node.js tests.');
  }
}

/**
 * Clears all data from IndexedDB
 * @param {string} dbName - Database name
 * @param {string} storeName - Store name
 * @returns {Promise<void>}
 */
export async function clearIndexedDB(dbName = 'InfosecCryptoDB', storeName = 'identityKeys') {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      // In Node.js environment, IndexedDB operations would be mocked
      resolve();
      return;
    }

    const request = indexedDB.open(dbName);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        db.close();
        resolve();
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    };
  });
}

/**
 * Gets data from IndexedDB
 * @param {string} dbName - Database name
 * @param {string} storeName - Store name
 * @param {string} key - Key to retrieve
 * @returns {Promise<Object|null>} Retrieved data or null
 */
export async function getFromIndexedDB(dbName, storeName, key) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    const request = indexedDB.open(dbName);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getRequest = store.get(key);
      
      getRequest.onsuccess = () => {
        db.close();
        resolve(getRequest.result || null);
      };
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

/**
 * Stores data in IndexedDB
 * @param {string} dbName - Database name
 * @param {string} storeName - Store name
 * @param {Object} data - Data to store
 * @returns {Promise<void>}
 */
export async function putInIndexedDB(dbName, storeName, data) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve();
      return;
    }

    const request = indexedDB.open(dbName);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const putRequest = store.put(data);
      
      putRequest.onsuccess = () => {
        db.close();
        resolve();
      };
      putRequest.onerror = () => reject(putRequest.error);
    };
  });
}

