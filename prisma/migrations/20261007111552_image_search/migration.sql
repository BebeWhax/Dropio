-- CreateTable
CREATE TABLE "ImageSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "imageMime" TEXT NOT NULL,
    "imageData" BLOB NOT NULL,
    "country" TEXT NOT NULL,
    "hint" TEXT,
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageSearch_publicToken_key" ON "ImageSearch"("publicToken");

-- CreateIndex
CREATE INDEX "ImageSearch_userId_createdAt_idx" ON "ImageSearch"("userId", "createdAt");
