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
  // Website ID from cloud.umami.is. Leave it empty to turn analytics off.
  umamiWebsiteId: '72b47921-77da-4f40-86c2-baa9a47e7026',
};

export interface Job {
  title: string;
  org: string;
  url?: string;
  location?: string;
  when: string;
  note?: string;
  text: string;
  // Opened by clicking the row: what I did, then what I used.
  points?: string[];
  tools?: string[];
}

// From my resume, newest first.
export const experience: Job[] = [
  {
    title: 'Incoming Undergraduate Researcher',
    org: 'Parallel and Distributed Computing Lab, SFU',
    url: 'https://www.cs.sfu.ca/~keval/',
    location: 'Burnaby, BC',
    when: 'Jan 2027 – Apr 2027',
    text: "Joining Prof. Keval Vora's lab to work on distributed graph mining systems.",
  },
  {
    title: '[role title]',
    org: 'Develop for Good',
    url: 'https://www.developforgood.org',
    when: 'Oct 2026 – Feb 2027',
    note: 'Winter cohort',
    text: 'Migrating a website with 5,000+ users off Squarespace to a stack I run on AWS: a React frontend on S3 and CloudFront, a FastAPI backend on Lambda behind API Gateway, and PostgreSQL on RDS.',
    tools: ['React', 'FastAPI', 'PostgreSQL', 'AWS'],
  },
  {
    title: 'Software Engineer Intern (Site Reliability)',
    org: 'DarkVision',
    url: 'https://darkvisiontech.com',
    location: 'Vancouver, BC',
    when: 'May 2026 – Dec 2026',
    text: 'Built the tools engineers use to find and move 2+ PB of ultrasound inspection data, and helped run the Kubernetes and AWS platform behind them.',
    points: [
      'Built a full-stack inspection manager with React and FastAPI, running in Docker on on-prem servers, that indexes 2+ PB of ultrasound data across those servers and AWS S3 to cut file lookups from 5 minutes to 10 seconds.',
      'Built a transfer runner that moves 70 TB between on-prem servers and AWS S3 with a PostgreSQL job queue.',
      'Sped up rendering by 30% in a C++ data server by swapping a global lock for per-dataset locks and atomics.',
      'Cut machine learning compute costs by 25% by auto-scaling Kubernetes GPU nodes with Karpenter and KEDA.',
      'Wrote reusable Terraform modules for SCPs, least-privilege IAM, and CloudTrail alarms in 10+ AWS accounts.',
      'Cut incident response time by 47% with Prometheus and Grafana Slack alerts across 300 Kubernetes nodes.',
    ],
    tools: [
      'React',
      'FastAPI',
      'C++',
      'Docker',
      'AWS',
      'PostgreSQL',
      'Kubernetes',
      'Karpenter',
      'KEDA',
      'Terraform',
      'Prometheus',
      'Grafana',
    ],
  },
  {
    title: 'Lead Software Engineer',
    org: 'SFU Blueprint',
    url: 'https://www.sfublueprint.org',
    location: 'Burnaby, BC',
    when: 'Sep 2025 – May 2026',
    text: 'Led 8 engineers building a volunteer scheduling app for a local animal welfare nonprofit with 1,000+ users.',
    points: [
      "Led 8 engineers through sprint planning and code reviews to build a React app for a nonprofit's 1,000+ users.",
      'Built stateless FastAPI backend APIs with idempotent endpoints so retries never double-book a single volunteer.',
      'Cut volunteer search latency by 53% by adding MongoDB compound indexes and a Redis read-through cache.',
      'Cut deploy time by 60% by replacing manual server setup and releases with Terraform and GitHub Actions.',
    ],
    tools: ['React', 'FastAPI', 'MongoDB', 'Redis', 'Terraform', 'GitHub Actions'],
  },
  {
    title: 'Software Engineer',
    org: 'CJSF Radio',
    url: 'https://www.linkedin.com/company/cjsf-90-1',
    location: 'Burnaby, BC',
    when: 'Oct 2024 – May 2025',
    text: "Fixed a bug that caused 15% of scheduled radio shows to fail, and moved the station's website to the cloud.",
    points: [
      "Moved the station's old PHP monolith into Docker services on AWS EKS, serving 300+ live listeners at once.",
      'Fixed a race condition that failed 15% of scheduled radio shows by moving jobs to asynchronous Redis queues.',
      'Built a Redis pub/sub and PostgreSQL pipeline that tracks listener drop-off and peak load across 50+ shows.',
    ],
    tools: ['PHP', 'Docker', 'AWS', 'Kubernetes', 'Redis', 'PostgreSQL'],
  },
];

// The skills on my resume, plus Swift and PyTorch, which two of the projects here use.
export const stack: { group: string; items: string[] }[] = [
  { group: 'Languages', items: ['Go', 'Java', 'C++', 'Python', 'TypeScript', 'JavaScript', 'SQL', 'Bash', 'Swift'] },
  {
    group: 'Frameworks',
    items: ['FastAPI', 'Spring Boot', 'gRPC', 'Flask', 'Express', 'React', 'Next.js', 'Node.js', 'PyTorch'],
  },
  {
    group: 'Cloud and Infra',
    items: [
      'AWS',
      'GCP',
      'Kubernetes',
      'Docker',
      'Terraform',
      'Terragrunt',
      'Helm',
      'KEDA',
      'Karpenter',
      'Linux',
      'TCP/IP',
    ],
  },
  { group: 'Tools', items: ['PostgreSQL', 'Redis', 'MongoDB', 'Prometheus', 'Grafana', 'Git', 'GitHub Actions'] },
];
