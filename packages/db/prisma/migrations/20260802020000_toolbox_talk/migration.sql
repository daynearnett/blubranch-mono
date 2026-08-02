-- Toolbox Talk (E2) — daily code/safety question with per-user answers/streaks.

CREATE TABLE "toolbox_questions" (
    "id" UUID NOT NULL,
    "active_on" DATE,
    "question" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "correct_index" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "toolbox_questions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "toolbox_questions_active_on_key" ON "toolbox_questions"("active_on");

CREATE TABLE "toolbox_answers" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "choice_index" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "toolbox_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "toolbox_answers_question_id_user_id_key" ON "toolbox_answers"("question_id", "user_id");
CREATE INDEX "toolbox_answers_user_id_answered_at_idx" ON "toolbox_answers"("user_id", "answered_at");

ALTER TABLE "toolbox_answers" ADD CONSTRAINT "toolbox_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "toolbox_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "toolbox_answers" ADD CONSTRAINT "toolbox_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
