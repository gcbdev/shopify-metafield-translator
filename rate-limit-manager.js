/**
 * Rate Limit Manager for Shopify API
 * Implements best practices from: https://www.shopify.com/ph/partners/blog/optimize-rate-limit
 */

const axios = require('axios');

class RateLimitManager {
  constructor(shop, accessToken) {
    this.shop = shop;
    this.accessToken = accessToken;
    this.rateLimitThreshold = 50; // Wait if below 50 points available
    this.waitInterval = 1000; // Wait 1 second (50 points refill)
    this.lastCheckTime = 0;
    this.cachedAvailablePoints = 1000; // Cache the last known available points
    this.cacheDuration = 2000; // Cache for 2 seconds
  }

  /**
   * Check rate limit and wait if necessary
   * @returns {Promise<void>}
   */
  async ensureRateLimitAvailable() {
    // Use cached value if recent, otherwise fetch fresh
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastCheckTime;
    
    let availablePoints;
    if (timeSinceLastCheck < this.cacheDuration) {
      // Use cached value
      availablePoints = this.cachedAvailablePoints;
    } else {
      // Fetch fresh value
      availablePoints = await this.getAvailableRateLimit();
      this.cachedAvailablePoints = availablePoints;
      this.lastCheckTime = now;
    }
    
    if (availablePoints < this.rateLimitThreshold) {
      console.log(`⏱️ Rate limit getting low (${availablePoints} points available). Waiting ${this.waitInterval}ms...`);
      await new Promise(resolve => setTimeout(resolve, this.waitInterval));
      console.log('✅ Done waiting - continuing requests');
      // Clear cache after waiting so next check gets fresh data
      this.lastCheckTime = 0;
    }
  }

  /**
   * Get available rate limit points from GraphQL extensions
   * @returns {Promise<number>} Available rate limit points
   */
  async getAvailableRateLimit() {
    try {
      // Use GraphQL to get rate limit info via extensions
      const query = `
        query {
          shop {
            id
          }
        }
      `;

      const response = await axios.post(
        `https://${this.shop}/admin/api/2025-01/graphql.json`,
        { query },
        {
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      // Extract rate limit info from extensions
      if (response.data.extensions && response.data.extensions.cost) {
        const available = response.data.extensions.cost.throttleStatus?.currentlyAvailable || 1000;
        console.log(`📊 Rate limit: ${available} points available`);
        return available;
      }

      // Fallback: Try to get from response headers
      const rateLimitHeader = response.headers['x-shopify-shop-api-call-limit'];
      if (rateLimitHeader) {
        const [used, total] = rateLimitHeader.split('/').map(Number);
        const available = total - used;
        console.log(`📊 Rate limit (header): ${available} points available`);
        return available;
      }

      // Default to 1000 if no info available
      return 1000;
    } catch (error) {
      console.error('⚠️ Could not get rate limit info:', error.message);
      // Default to safe value
      return 1000;
    }
  }

  /**
   * Make a GraphQL request with rate limit protection
   * @param {string} query - GraphQL query string
   * @param {object} variables - GraphQL variables
   * @returns {Promise<object>} Response data
   */
  async makeGraphQLRequest(query, variables = {}) {
    // Check rate limit before making request
    await this.ensureRateLimitAvailable();

    const response = await axios.post(
      `https://${this.shop}/admin/api/2025-01/graphql.json`,
      { query, variables },
      {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    // Log rate limit info from response and update cache
    if (response.data.extensions && response.data.extensions.cost) {
      const available = response.data.extensions.cost.throttleStatus?.currentlyAvailable || 1000;
      console.log(`📊 Rate limit after request: ${available} points available`);
      // Update cache with fresh data
      this.cachedAvailablePoints = available;
      this.lastCheckTime = Date.now();
    }

    return response.data;
  }

  /**
   * Get available rate limit points (for display/logging)
   * @returns {Promise<number>}
   */
  async getRateLimitStatus() {
    try {
      const available = await this.getAvailableRateLimit();
      return {
        available,
        threshold: this.rateLimitThreshold,
        isLow: available < this.rateLimitThreshold
      };
    } catch (error) {
      return {
        available: 1000,
        threshold: this.rateLimitThreshold,
        isLow: false
      };
    }
  }
}

module.exports = RateLimitManager;
