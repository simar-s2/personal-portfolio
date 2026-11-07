import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    category: z.string(),
    // One line for the home page.
    blurb: z.string(),
    // The opening paragraph of the case study.
    summary: z.string(),
    pill: z.string(),
    repo: z.string().url().optional(),
    live: z.string().url().optional(),
    repoNote: z.string().optional(),
    stack: z.array(z.string()),
    results: z.array(z.object({ label: z.string(), value: z.string(), note: z.string() })),
    problem: z.array(z.string()),
    pipeline: z.array(z.object({ name: z.string(), note: z.string() })),
  }),
});

export const collections = { projects };
