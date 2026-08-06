/*
  Warnings:

  - A unique constraint covering the columns `[studentId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('AWAITING_NAME', 'AWAITING_INSTITUTE', 'AWAITING_STUDENT_ID');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "institute" TEXT,
ADD COLUMN     "onboardingStep" "OnboardingStep" NOT NULL DEFAULT 'AWAITING_NAME',
ADD COLUMN     "studentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");
