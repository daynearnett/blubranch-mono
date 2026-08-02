-- Wage transparency Phase 0 (E3): pay-period on jobs so hourly aggregates
-- can't be poisoned by salary figures. Existing rows are hourly by convention
-- (the UI has always displayed pay as "/hr").
CREATE TYPE "PayPeriod" AS ENUM ('hourly', 'daily', 'salary');
ALTER TABLE "jobs" ADD COLUMN "pay_period" "PayPeriod" NOT NULL DEFAULT 'hourly';
