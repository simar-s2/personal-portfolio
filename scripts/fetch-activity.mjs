// Saves my contribution calendar so the site can draw it with no requests at runtime.
// Runs before each deploy. If it fails, the last saved copy is used instead.

import { writeFileSync } from 'node:fs';

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
if (!token) {
  console.log('No GitHub token, keeping the saved activity.');
  process.exit(0);
}

const levels = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const query = `{ user(login: "simar-s2") { contributionsCollection { contributionCalendar {
  totalContributions weeks { contributionDays { date contributionLevel } } } } } }`;

try {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'personal-portfolio' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  const calendar = json.data.user.contributionsCollection.contributionCalendar;
  const weeks = calendar.weeks.map((w) => ({
    start: w.contributionDays[0].date,
    firstWeekday: new Date(`${w.contributionDays[0].date}T00:00:00Z`).getUTCDay(),
    days: w.contributionDays.map((d) => levels[d.contributionLevel] ?? 0),
  }));
  writeFileSync('src/data/activity.json', `${JSON.stringify({ total: calendar.totalContributions, weeks })}\n`);
  console.log(`Saved ${calendar.totalContributions} contributions.`);
} catch (error) {
  console.log('Keeping the saved activity:', error.message);
}
