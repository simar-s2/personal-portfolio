---
title: Quizzera
order: 5
category: Full-stack product
blurb: Next.js and Supabase study app that writes practice quizzes from notes or PDFs with Gemini, grades them, and schedules reviews. Live at quizzera.com.
summary: A study app I built and run at quizzera.com. It generates practice quizzes from notes, PDFs or a topic with Gemini, grades the answers, gives AI feedback on written ones, and schedules reviews with the SM-2 spaced repetition algorithm.
pill: Live in production
live: https://quizzera.com
repoNote: Private repo
stack: [Next.js, TypeScript, React, Supabase, PostgreSQL, Tailwind CSS]
results:
  - label: Status
    value: Live
    note: Running at quizzera.com, with accounts, billing and error monitoring.
  - label: Question types
    value: '5'
    note: Multiple choice, true/false, fill in the blank, short answer and essay.
  - label: Users
    value: '[number]'
    note: '[Add the user count]'
  - label: Quizzes generated
    value: '[number]'
    note: '[Add the quiz count]'
problem:
  - Writing practice questions takes longer than most students have, and past papers run out.
  - Generating questions with a model is the easy part. The app also has to keep working when a model is overloaded, keep each user's data separate, cap how much AI each account can use, and check model output before saving it.
pipeline:
  - name: Source
    note: notes, PDFs or a topic
  - name: Quota
    note: rate limit before any AI call
  - name: Generate
    note: Gemini with model fallback
  - name: Validate
    note: schema check, repair the LaTeX
  - name: Save
    note: one transaction, row-level security
  - name: Review
    note: grade, then schedule with SM-2
---

Quizzera is a Next.js 15 app on the App Router, deployed on Vercel. Server components read data directly, and mutations are server actions that return a typed result. Supabase provides PostgreSQL and auth, and Stripe handles billing.

A quiz is only generated when a user asks for one. The request is validated, checked against a per-user quota, and sent to Gemini through the Vercel AI SDK, with the output constrained to a schema and streamed back so questions appear as they're written. If a model is unavailable, a fallback chain tries the next one.

Quizzes can include math, so the raw LaTeX is stored and repaired when the model gets it wrong. KaTeX only loads for text that contains math.

Finished quizzes come back on a schedule. I implemented SM-2, mapping a 0 to 100 score to a recall quality and scheduling the next review from it. A failed review resets the schedule.

## Design decisions

- **Row-level security on every table.** Access rules live in the database, so a bug in a page can't leak another user's data. Analytics views run with the caller's permissions for the same reason.
- **Multi-table writes in database functions.** Creating a quiz or submitting an attempt touches several tables, so each runs as one transaction.
- **Fallback across models.** One overloaded model shouldn't fail a user's quiz.
- **Quota checked before the AI call.** A burst of requests can't run up the bill.
- **Validation code kept out of the browser.** Client code imports plain constants instead of the schemas, so the validation library stays out of the bundle.
- **Skeleton loading states.** They match the layout of what's loading and only appear after 300 ms, so fast loads don't flicker.

## Features

- Quizzes from notes, PDFs or a topic, with a choice of difficulty, question types and length.
- Instant grading with explanations, and AI feedback on written answers.
- Spaced repetition reviews.
- Progress by subject, difficulty and question type.
- PDF export of any quiz, account data export, and subscription billing.

## Known limits

- No automated test suite yet. A pre-commit hook runs ESLint on staged files and a full type check.
- Question quality depends on the model and the source material, so every answer comes with an explanation people can check.

## Try it

Live at [quizzera.com](https://quizzera.com).
