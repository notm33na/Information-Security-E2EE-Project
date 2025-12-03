/**
 * Mock MongoDB Utilities
 * Provides mock database operations for testing
 */

/**
 * Creates a mock MessageMeta collection
 * @returns {Object} Mock collection
 */
export function createMockMessageMetaCollection() {
  const documents = [];
  
  return {
    /**
     * Insert a document
     * @param {Object} doc - Document to insert
     * @returns {Promise<Object>} Inserted document
     */
    async insertOne(doc) {
      // Verify no ciphertext fields
      const forbiddenFields = ['ciphertext', 'iv', 'authTag', 'nonce'];
      for (const field of forbiddenFields) {
        if (doc[field] !== undefined) {
          throw new Error(`Forbidden field '${field}' detected in document`);
        }
      }
      
      documents.push({ ...doc, _id: `mock-id-${documents.length}` });
      return { insertedId: documents[documents.length - 1]._id };
    },
    
    /**
     * Find documents
     * @param {Object} query - Query object
     * @returns {Object} Mock query result
     */
    find(query = {}) {
      return {
        toArray: async () => {
          return documents.filter(doc => {
            for (const key in query) {
              if (doc[key] !== query[key]) {
                return false;
              }
            }
            return true;
          });
        },
        
        sort: function(sortObj) {
          return this;
        },
        
        limit: function(limit) {
          return this;
        },
        
        skip: function(skip) {
          return this;
        }
      };
    },
    
    /**
     * Find one document
     * @param {Object} query - Query object
     * @returns {Promise<Object|null>} Document or null
     */
    async findOne(query) {
      const results = await this.find(query).toArray();
      return results.length > 0 ? results[0] : null;
    },
    
    /**
     * Get all documents
     * @returns {Array} All documents
     */
    getAllDocuments() {
      return documents;
    },
    
    /**
     * Clear all documents
     */
    clear() {
      documents.length = 0;
    },
    
    /**
     * Verify no ciphertext fields in any document
     * @returns {boolean} True if no ciphertext fields found
     */
    verifyNoCiphertext() {
      const forbiddenFields = ['ciphertext', 'iv', 'authTag', 'nonce'];
      for (const doc of documents) {
        for (const field of forbiddenFields) {
          if (doc[field] !== undefined) {
            return false;
          }
        }
      }
      return true;
    }
  };
}

