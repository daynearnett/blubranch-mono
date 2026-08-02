-- Ticket wallet: certifications gain expiry (OSHA/forklift/welding tickets
-- lapse like licenses) and reminder dedup, so the nightly license-expiration
-- job can cover a worker's whole ticket book.
ALTER TABLE "certifications" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "certifications" ADD COLUMN "reminded_at" TIMESTAMP(3);
