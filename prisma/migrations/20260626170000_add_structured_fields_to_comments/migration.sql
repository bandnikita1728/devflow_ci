-- AlterTable
ALTER TABLE "ReviewComment" ADD COLUMN "category" TEXT;
ALTER TABLE "ReviewComment" ADD COLUMN "title" TEXT;
ALTER TABLE "ReviewComment" ADD COLUMN "explanation" TEXT;
ALTER TABLE "ReviewComment" ADD COLUMN "owaspRef" TEXT;
ALTER TABLE "ReviewComment" ADD COLUMN "owaspUrl" TEXT;
ALTER TABLE "ReviewComment" ADD COLUMN "fixDescription" TEXT;
ALTER TABLE "ReviewComment" ADD COLUMN "fixCode" TEXT;
ALTER TABLE "ReviewComment" ADD COLUMN "fixLanguage" TEXT;
