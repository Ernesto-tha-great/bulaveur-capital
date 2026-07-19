-- AlterEnum
ALTER TYPE "InstrumentType" ADD VALUE 'tbill';
ALTER TYPE "InstrumentType" ADD VALUE 'commercial_paper';
ALTER TYPE "InstrumentType" ADD VALUE 'trade_finance';

-- AlterEnum
ALTER TYPE "NoteKind" ADD VALUE 'em_market_note';
ALTER TYPE "NoteKind" ADD VALUE 'em_digest';

-- AlterTable
ALTER TABLE "Issuer" ADD COLUMN "market" TEXT;

-- AlterTable
ALTER TABLE "MarketObservation" ADD COLUMN "market" TEXT;

-- AlterTable
ALTER TABLE "ResearchNote" ADD COLUMN "market" TEXT;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN "market" TEXT,
ADD COLUMN "actionability" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "shareability" INTEGER NOT NULL DEFAULT 3;

-- CreateIndex
CREATE INDEX "MarketObservation_market_asOf_idx" ON "MarketObservation"("market", "asOf");

-- CreateIndex
CREATE INDEX "ResearchNote_market_createdAt_idx" ON "ResearchNote"("market", "createdAt");

-- CreateIndex
CREATE INDEX "Recommendation_market_createdAt_idx" ON "Recommendation"("market", "createdAt");
