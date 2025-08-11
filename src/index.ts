import { Hono } from 'hono';
import authRouter from './routes/auth-router';

const app = new Hono();

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.route('/auth', authRouter);

export default {
  port: Bun.env.PORT || 3000,
  fetch: app.fetch,
};
