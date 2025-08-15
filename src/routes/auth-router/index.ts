import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { prisma } from 'src/db';
import { REFRESH_TOKEN_COOKIE_PREFIX } from 'src/routes/auth-router/constants';
import {
  generateAccessToken,
  generateRefreshToken,
} from 'src/routes/auth-router/helper';
import {
  loginPayloadSchema,
  registerPayloadSchema,
} from 'src/routes/auth-router/schema';
import { isProd } from 'src/utils/is-prod';

const app = new Hono<{
  Variables: AppEnvVariables;
}>();

app
  // ! LOGIN
  .post('/login', zValidator('json', loginPayloadSchema), async (c) => {
    const { email, password } = c.req.valid('json');

    const user = await prisma.users.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new HTTPException(404, {
        message: 'User not found',
      });
    }

    const isValid = await Bun.password.verify(password, user.password);

    if (!isValid) {
      throw new HTTPException(401, {
        message: 'Invalid credentials',
      });
    }

    const accessToken = await generateAccessToken({
      email: user.email,
      id: user.id,
    });

    const { sessionId, refreshToken, refreshExpires } = generateRefreshToken();

    const hashedRefreshToken = await Bun.password.hash(refreshToken, {
      algorithm: 'argon2id',
    });

    await prisma.sessions.create({
      data: {
        sessionId,
        expiresAt: refreshExpires,
        userAgent: c.req.header('user-agent') || 'unknown',
        ip:
          c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
          c.req.header('cf-connecting-ip') ||
          'unknown',
        familyId: Bun.randomUUIDv7(),
        tokenHashed: hashedRefreshToken,
        userId: user.id,
      },
    });

    setCookie(c, REFRESH_TOKEN_COOKIE_PREFIX, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
      expires: refreshExpires,
    });

    return c.json({ message: 'Login successful!', accessToken });
  })
  // ! REGISTER
  .post('/register', zValidator('json', registerPayloadSchema), async (c) => {
    const { email, password } = c.req.valid('json');

    const existingUser = await prisma.users.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new HTTPException(409, {
        message: 'User already exists',
      });
    }

    const hashPassword = await Bun.password.hash(password);

    const newUser = await prisma.users.create({
      select: {
        email: true,
        createdAt: true,
        updatedAt: true,
      },
      data: {
        email,
        password: hashPassword,
      },
    });

    return c.json(
      { message: 'User registered successfully', user: newUser },
      201,
    );
  })
  // ! LOGOUT
  .post('/logout', async (c) => {
    const rt = getCookie(c, REFRESH_TOKEN_COOKIE_PREFIX);

    if (!rt) {
      deleteCookie(c, REFRESH_TOKEN_COOKIE_PREFIX);

      return c.json({ message: 'Ok' });
    }

    const sessionId = rt.split('.')[0];
    const refreshToken = rt.split('.')[1];

    const session = await prisma.sessions.findUnique({
      where: {
        sessionId,
      },
    });

    if (!session) {
      deleteCookie(c, REFRESH_TOKEN_COOKIE_PREFIX);

      return c.json({ message: 'Ok' });
    }

    const validRefreshToken = await Bun.password.verify(
      refreshToken,
      session.tokenHashed,
    );

    if (!validRefreshToken) {
      deleteCookie(c, REFRESH_TOKEN_COOKIE_PREFIX);

      return c.json({ message: 'Ok' });
    }

    await prisma.sessions.update({
      where: {
        familyId: session.familyId,
        revokeAt: null,
      },
      data: {
        revokeAt: new Date(),
      },
    });

    deleteCookie(c, REFRESH_TOKEN_COOKIE_PREFIX);

    return c.json({ message: 'Ok' });
  })
  .post('/refresh', async (c) => {
    const rt = getCookie(c, REFRESH_TOKEN_COOKIE_PREFIX);

    if (!rt) {
      deleteCookie(c, REFRESH_TOKEN_COOKIE_PREFIX);

      throw new HTTPException(401, {
        message: 'Refresh token not found',
      });
    }

    const sessionId = rt.split('.')[0];

    const oldSession = await prisma.sessions.findUnique({
      where: {
        sessionId,
      },
      include: {
        user: {
          select: {
            email: true,
            id: true,
          },
        },
      },
    });

    if (!oldSession) {
      deleteCookie(c, REFRESH_TOKEN_COOKIE_PREFIX);

      throw new HTTPException(401, {
        message: 'Invalid session',
      });
    }

    if (oldSession.expiresAt <= new Date()) {
      await prisma.sessions.update({
        where: {
          sessionId: oldSession.sessionId,
        },
        data: {
          revokeAt: oldSession.revokeAt ?? new Date(),
        },
      });

      deleteCookie(c, REFRESH_TOKEN_COOKIE_PREFIX);

      throw new HTTPException(401, {
        message: 'Session expired',
      });
    }

    if (oldSession.revokeAt) {
      if (oldSession.replaceById) {
        // Revoke all devices
        await prisma.sessions.updateMany({
          where: { familyId: oldSession.familyId, revokeAt: null },
          data: { revokeAt: new Date() },
        });

        deleteCookie(c, REFRESH_TOKEN_COOKIE_PREFIX);

        throw new HTTPException(401, {
          message: 'Session revoked',
        });
      }
    }

    const validRefreshToken = await Bun.password.verify(
      rt,
      oldSession.tokenHashed,
    );

    // check fake refresh token
    if (!validRefreshToken) {
      deleteCookie(c, REFRESH_TOKEN_COOKIE_PREFIX);

      throw new HTTPException(401, {
        message: 'Invalid refresh token',
      });
    }

    // create new session
    const {
      refreshExpires,
      refreshToken,
      sessionId: newSessionId,
    } = generateRefreshToken();

    const hashedRefreshToken = await Bun.password.hash(refreshToken);

    const newSession = await prisma.$transaction(async (tx) => {
      const createdSession = await tx.sessions.create({
        data: {
          sessionId: newSessionId,
          expiresAt: refreshExpires,
          userAgent: c.req.header('user-agent') || 'unknown',
          ip:
            c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
            c.req.header('cf-connecting-ip') ||
            'unknown',
          familyId: Bun.randomUUIDv7(),
          tokenHashed: hashedRefreshToken,
          userId: oldSession.userId,
        },
      });

      await tx.sessions.update({
        where: {
          sessionId: oldSession.sessionId,
        },
        data: {
          revokeAt: new Date(),
          replaceById: createdSession.sessionId,
        },
      });

      return createdSession;
    });

    setCookie(
      c,
      REFRESH_TOKEN_COOKIE_PREFIX,
      `${newSession.sessionId}.${refreshToken}`,
      {
        httpOnly: true,
        secure: isProd,
        sameSite: 'Lax',
        expires: refreshExpires,
      },
    );

    const accessToken = await generateAccessToken({
      email: oldSession.user.email,
      id: oldSession.user.id,
    });

    return c.json({
      message: 'Ok',
      accessToken,
    });
  });

export default app;
