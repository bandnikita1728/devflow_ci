-- AlterTable
ALTER TABLE "User" ADD COLUMN     "privacyAccepted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "PullRequest_createdAt_idx" ON "PullRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ReviewComment_createdAt_idx" ON "ReviewComment"("createdAt");

-- CreateIndex
CREATE INDEX "ReviewJob_createdAt_idx" ON "ReviewJob"("createdAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
