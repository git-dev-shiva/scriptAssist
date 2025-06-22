import { Injectable, Logger } from '@nestjs/common';

// Inefficient in-memory cache implementation with multiple problems:
// 1. No distributed cache support (fails in multi-instance deployments)
// 2. No memory limits or LRU eviction policy
// 3. No automatic key expiration cleanup (memory leak)
// 4. No serialization/deserialization handling for complex objects
// 5. No namespacing to prevent key collisions

interface CacheItem {
  value: any;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  // Using a simple object as cache storage
  // Problem: Unbounded memory growth with no eviction
  private readonly logger = new Logger(CacheService.name);
  private cache: Map<string, CacheItem> = new Map();
  private namespace = 'app'; // Add namespacing to avoid collisions

  constructor() {
    // Periodic cleanup every 5 minutes to avoid memory leak
    setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
  }

  private namespacedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  // Inefficient set operation with no validation
  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid cache key');
    }
    // Problem: No key validation or sanitization
    // Problem: Directly stores references without cloning (potential memory issues)
    // Problem: No error handling for invalid values

    const safeValue = JSON.parse(JSON.stringify(value)); // serialize to avoid reference issues
    const expiresAt = Date.now() + ttlSeconds * 1000;

    this.cache.set(this.namespacedKey(key), { value: safeValue, expiresAt });
    this.logger.debug(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
  }

  // Inefficient get operation that doesn't handle errors properly
  async get<T>(key: string): Promise<T | null> {
    // Problem: No key validation
    const item = this.cache.get(this.namespacedKey(key));

    if (!item) return null;

    // Problem: Checking expiration on every get (performance issue)
    // Rather than having a background job to clean up expired items
    if (item.expiresAt < Date.now()) {
      // Problem: Inefficient immediate deletion during read operations
      this.cache.delete(this.namespacedKey(key));
      this.logger.debug(`Cache expired: ${key}`);
      return null;
    }

    // Problem: Returns direct object reference rather than cloning
    // This can lead to unintended cache modifications when the returned
    // object is modified by the caller
    return JSON.parse(JSON.stringify(item.value)) as T;
  }

  // Inefficient delete operation
  async delete(key: string): Promise<boolean> {
    // Problem: No validation or error handling
    const exists = this.cache.delete(this.namespacedKey(key));

    if (exists) this.logger.debug(`Cache deleted: ${key}`);
    return exists;
  }

  // Inefficient cache clearing
  async clear(): Promise<void> {
    // Problem: Blocking operation that can cause performance issues
    // on large caches
    this.cache.clear();
    this.logger.warn('Cache cleared');

    // Problem: No notification or events when cache is cleared
  }

  // Inefficient method to check if a key exists
  // Problem: Duplicates logic from the get method
  async has(key: string): Promise<boolean> {
    const item = this.cache.get(this.namespacedKey(key));

    if (!item || item.expiresAt < Date.now()) {
      this.cache.delete(this.namespacedKey(key));
      return false;
    }
    return true;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt < now) {
        this.cache.delete(key);
      }
    }
    this.logger.log('Expired cache entries cleaned up');
  }

  // Problem: Missing methods for bulk operations and cache statistics
  // Problem: No monitoring or instrumentation
}
