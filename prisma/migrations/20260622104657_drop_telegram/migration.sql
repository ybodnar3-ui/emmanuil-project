/*
  Warnings:

  - You are about to drop the column `telegramChatId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `telegramLinkCode` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_telegramChatId_key";

-- DropIndex
DROP INDEX "User_telegramLinkCode_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "telegramChatId",
DROP COLUMN "telegramLinkCode";
