import { RedisClient } from 'bun';
import { createFactory } from 'hono/factory';

declare global {
  var __redis__: RedisClient | undefined;

  export interface AppEnvVariables {
    redis: RedisClient;
  }
}

const factory = createFactory<{
  Variables: AppEnvVariables;
}>();

const getRedis = () => {
  if (global.__redis__) return global.__redis__;

  const redis = new RedisClient(Bun.env.REDIS_URL, {
    autoReconnect: true,
    maxRetries: 3,
    connectionTimeout: 10000,
  });

  if (!redis.connected) {
    redis.connect();
  }

  redis.onconnect = () => {
    console.log('Redis connected');
  };

  global.__redis__ = redis;
  return redis;
};

export const attachRedis = factory.createMiddleware(async (c, next) => {
  const redis = getRedis();

  c.set('redis', redis);

  await next();
});
