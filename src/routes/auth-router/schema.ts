import z from 'zod';

const loginPayloadSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(100),
});

type LoginPayload = z.infer<typeof loginPayloadSchema>;

const registerPayloadSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(100),
});

type RegisterPayload = z.infer<typeof registerPayloadSchema>;

export {
  LoginPayload,
  loginPayloadSchema,
  RegisterPayload,
  registerPayloadSchema,
};
