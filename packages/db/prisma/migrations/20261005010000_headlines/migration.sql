-- Today's Headlines: top blue-collar industry story, fetched daily from the
-- trade press (RSS) and surfaced in the feed where Toolbox Talk used to sit.
CREATE TABLE "headlines" (
    "id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "summary" TEXT,
    "image_url" VARCHAR(1000),
    "published_at" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "headlines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "headlines_url_key" ON "headlines"("url");
CREATE INDEX "headlines_published_at_idx" ON "headlines"("published_at");
