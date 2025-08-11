-- CreateTable
CREATE TABLE "public"."sessions" (
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "token_hashed" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "replace_by_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoke_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_id_key" ON "public"."sessions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hashed_key" ON "public"."sessions"("token_hashed");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_family_id_key" ON "public"."sessions"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_replace_by_id_key" ON "public"."sessions"("replace_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
