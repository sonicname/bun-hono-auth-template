import { Hono } from 'hono';
import { attachRedis } from 'src/utils/redis';
import authRouter from './routes/auth-router';

const app = new Hono<{
  Variables: AppEnvVariables;
}>();

app.use('*', attachRedis);

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.route('/auth', authRouter);

export default {
  port: Bun.env.PORT || 3000,
  fetch: app.fetch,
};
