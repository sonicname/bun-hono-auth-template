import { sign } from 'hono/jwt';

function randomSecret(bytes = 32) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  // base64url encode
  return btoa(String.fromCharCode(...Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export const generateRefreshToken = () => {
  const generatedSessionId = Bun.randomUUIDv7();
  const refreshToken = randomSecret(32);
  const refreshExp = Date.now() + Number(process.env.REFRESH_TOKEN_EXP);

  return {
    sessionId: generatedSessionId,
    refreshToken: `${generatedSessionId}.${refreshToken}`,
    refreshExpires: new Date(refreshExp),
  };
};

const exp = process.env.JWT_EXP
  ? Number(process.env.JWT_EXP)
  : Math.floor(Date.now() / 1000) + 60 * 5;
const accessTokenSecret = process.env.JWT_SECRET ?? 'secret';

export const generateAccessToken = async ({
  id,
  email,
}: {
  id: string;
  email: string;
}) => {
  return sign(
    {
      sub: id,
      email,
      exp,
    },
    accessTokenSecret,
  );
};
