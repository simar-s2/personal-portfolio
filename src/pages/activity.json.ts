import type { APIRoute } from 'astro';
import activity from '../data/activity.json';

// Publishes the graph's data, so the refresh job can tell if the live site is out of date.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(activity), { headers: { 'Content-Type': 'application/json' } });
