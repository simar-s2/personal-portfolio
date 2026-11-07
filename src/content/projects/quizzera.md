---
title: Quizzera
order: 5
category: Full-stack product
blurb: An AI study tool that turns your notes into practice quizzes, with grading, feedback on written answers and spaced repetition. Live at quizzera.com.
summary: An AI study tool I built and run in production. Paste your notes, upload up to three PDFs, or just name a topic, and Quizzera writes a practice quiz from your material in seconds. It grades your answers, gives feedback on written ones, and brings quizzes back right when you're about to forget them.
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
  - Testing yourself is one of the best ways to study, but writing good practice questions takes longer than most people have, and past papers run out.
  - An AI model can write questions quickly, but that's the easy part. The product has to stay up when a model is overloaded, keep one user's data away from another's, stop one account from running up the bill, and turn raw model output into something safe to store and show.
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

Quizzera is a Next.js 15 app using the App Router, deployed on Vercel. Server components read data directly, and mutations are server actions that return a typed result. Supabase provides PostgreSQL and authentication, and Stripe handles billing.

A quiz is only generated when a user explicitly asks for one. The request is validated, checked against a per-user quota, and sent to Gemini through the Vercel AI SDK, with the model's output constrained to a schema and streamed back so the questions appear as they're written. If a model is unavailable, a fallback chain tries the next one.

Quizzes can include math, so the raw LaTeX is stored and repaired if the model got it wrong. KaTeX only loads for text that actually contains math, which keeps the common page light.

Finished quizzes come back on a schedule. I implemented SM-2, the spaced repetition algorithm, mapping a 0 to 100 score to a recall quality and scheduling the next review from there. A failed review resets the schedule.

## Decisions

- **Row-level security on every table.** Access rules live in the database, so a bug in a page can't leak another user's data. Analytics views run with the caller's permissions for the same reason.
- **Multi-table writes go through database functions.** Creating a quiz or submitting an attempt touches several tables, so each one runs as a single transaction and can't half-finish.
- **Fallback across models.** A single overloaded model shouldn't mean a failed quiz for the user.
- **Quota before the AI call.** The check runs first, so a burst of requests can't run up the bill.
- **Keep validation code out of the browser.** Client code imports plain constants instead of the schemas, so the validation library stays out of the bundle.
- **Skeletons shaped like the real content.** Loading states match what's coming and fade in after 300 ms, so fast loads don't flicker. Spinners are only for things a user just did.

## What's in it

- Quizzes from pasted notes, PDFs or a topic, with a choice of difficulty, question types and length.
- Instant results with explanations, and AI feedback on written answers.
- Spaced repetition that brings quizzes back for review.
- Progress tracking by subject, difficulty and question type.
- PDF export of any quiz, account data export, and subscription billing.

## Known limits

- There is no automated test suite yet. A pre-commit hook runs ESLint on staged files and a full type check.
- Question quality depends on the model and the source material, which is why results show explanations people can check.

## Try it

The app is live at [quizzera.com](https://quizzera.com). Your first quiz takes under a minute.
