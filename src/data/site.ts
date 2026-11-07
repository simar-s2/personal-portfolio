// Everything about me that appears on the site lives here, so it is easy to edit.
// A value in [square brackets] is a placeholder and renders with a dashed outline.

export const site = {
  name: 'Simarjot Singh',
  role: 'Software Engineer',
  tagline: 'Software Engineer · Math and Computer Science at SFU',
  description:
    'Math and Computer Science at Simon Fraser University. I build backend systems and the cloud infrastructure they run on.',
  location: 'Vancouver, BC',
  timezone: 'America/Vancouver',
  email: 'simarjot2468@gmail.com',
  github: { handle: 'simar-s2', url: 'https://github.com/simar-s2' },
  linkedin: { handle: 'singh-simar', url: 'https://www.linkedin.com/in/singh-simar/' },
  resume: '[resume PDF]',
  // Website ID from cloud.umami.is. Analytics stay off until this is filled in.
  umamiWebsiteId: '',
};

export interface Job {
  title: string;
  org: string;
  url?: string;
  when: string;
  note?: string;
  text: string;
}

export const experience: Job[] = [
  {
    title: 'Incoming Researcher',
    org: 'Parallel and Distributed Computing Lab, SFU',
    when: 'Jan 2027 – Apr 2027',
    text: 'Working on distributed graph mining systems.',
  },
  {
    title: '[role title]',
    org: 'Develop for Good',
    url: 'https://www.developforgood.org',
    when: 'Oct 2026 – Feb 2027',
    note: 'Winter cohort',
    text: 'Migrating a website with 5,000+ users off Squarespace to a stack I run on AWS: a React frontend on S3 and CloudFront, a FastAPI backend on Lambda behind API Gateway, and PostgreSQL on RDS.',
  },
  {
    title: 'Software Engineer Intern',
    org: 'DarkVision Technologies',
    url: 'https://darkvisiontech.com',
    when: 'May 2026 – Dec 2026',
    text: 'Built an inspection manager that cut file lookups for engineers from 5 minutes to 10 seconds, and helped run the Kubernetes and AWS platform behind it.',
  },
  {
    title: 'Software Engineer',
    org: 'SFU Blueprint',
    url: 'https://www.sfublueprint.org',
    when: 'Sep 2025 – May 2026',
    text: 'Built a volunteer scheduling app for a local animal welfare nonprofit with 1,000+ users.',
  },
  {
    title: 'Software Engineer',
    org: 'CJSF Radio',
    url: 'https://www.linkedin.com/company/cjsf-90-1',
    when: 'Jan 2025 – May 2025',
    text: "Fixed a bug that caused 15% of scheduled radio shows to fail, and moved the station's website to the cloud.",
  },
];

export const stack: { group: string; items: string[] }[] = [
  {
    group: 'Languages',
    items: ['Go', 'Java', 'Python', 'C', 'C++', 'TypeScript', 'JavaScript', 'Swift', 'SQL', 'Bash'],
  },
  {
    group: 'Backend',
    items: ['FastAPI', 'Spring Boot', 'Django', 'Flask', 'Node.js', 'gRPC', 'PostgreSQL', 'MongoDB', 'Redis', 'Kafka'],
  },
  { group: 'Frontend', items: ['React', 'Next.js', 'Tailwind CSS'] },
  {
    group: 'Cloud',
    items: ['AWS', 'Google Cloud', 'Kubernetes', 'Docker', 'Terraform', 'Helm', 'Prometheus', 'Grafana'],
  },
  { group: 'Tools', items: ['Linux', 'Git', 'GitHub Actions', 'Jenkins', 'PyTorch'] },
];

// One lesson from each project, in my own words from the READMEs.
export const lessons: { title: string; from: string; slug: string }[] = [
  {
    title: 'Check that the problem you caused really happened.',
    from: 'QuorumDB',
    slug: 'quorumdb',
  },
  {
    title: "Killing a process doesn't test fencing.",
    from: 'cluster-scheduler',
    slug: 'cluster-scheduler',
  },
  {
    title: 'Always compare against a simple baseline.',
    from: 'FaceMesh',
    slug: 'facemesh',
  },
];
