import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./content/posts" }),
  schema: z.object({
    author: z.string(),
    title: z.string(),
    summary: z.string(),
    image: z.object({
      src: z.string(),
      alt: z.string(),
      position: z.string().default('center'),
      fit: z.enum(['cover', 'contain']).default('cover'),
    }),
    tags: z.array(z.string()),
    date: z.coerce.date(),
    sticky: z.boolean().optional(),
  })
});

const projects = defineCollection({
  loader: file("content/projects/projects.json"),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    language: z.string(),
    category: z.string(),
    image: z.string().optional(),
    url: z.string(),
    featured: z.boolean().optional(),
  })
});

export const collections = { posts, projects };
