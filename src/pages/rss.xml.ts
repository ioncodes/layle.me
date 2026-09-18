import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection('posts', ({ data }) => !data.unlisted);

  return rss({
    title: "Layle's Lair",
    description: 'A place where a man gone mad gets to share his chaotic adventures.',
    site: site!,
    items: posts
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map((post) => ({
        title: post.data.title,
        description: post.data.summary,
        pubDate: post.data.date,
        link: `/posts/${post.id}/`,
        categories: post.data.tags,
      })),
    customData: '<language>en</language>',
  });
};
