-- Existing password accounts remain valid. Google-only accounts have no password.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "google_subject" TEXT;
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");
