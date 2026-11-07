// The panel under a render: the caption, what a clicked block does, and the walkthrough.

import type { Focus } from './focus';
import type { REntry, RScene } from './types';

const STEP_MS = 6500;

export class Story {
  private index = -1;
  private timer = 0;
  private title: HTMLElement;
  private text: HTMLElement;
  private link: HTMLAnchorElement;
  private cta: HTMLButtonElement | null;
  private nav: HTMLElement | null;
  private count: HTMLElement | null;
  private toggle: HTMLButtonElement | null;
  private auto = false;
  private rest: HTMLElement | null;
  private caseLink: HTMLAnchorElement | null;
  private repoLink: HTMLAnchorElement | null;
  private scene!: RScene;
  private focus!: Focus;
  private repo: string | undefined;
  private defaultTags: Record<string, string> = {};

  constructor(
    root: HTMLElement,
    private onChange: (tags: Record<string, string>) => void,
  ) {
    const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s);
    this.title = q('.cap-title')!;
    this.text = q('.cap-text')!;
    this.link = q<HTMLAnchorElement>('.cap-link')!;
    this.cta = q<HTMLButtonElement>('.cta');
    this.nav = q('.nav');
    this.count = q('.count');
    this.toggle = q<HTMLButtonElement>('.step-toggle');
    this.rest = q('.rest');
    this.caseLink = q<HTMLAnchorElement>('[data-case-link]');
    this.repoLink = q<HTMLAnchorElement>('[data-repo-link]');

    this.cta?.addEventListener('click', () => this.play());
    q('.step-prev')?.addEventListener('click', () => this.manual(this.index - 1));
    q('.step-next')?.addEventListener('click', () => this.manual(this.index + 1));
    q('.step-exit')?.addEventListener('click', () => this.reset());
    this.toggle?.addEventListener('click', () => {
      this.auto = !this.auto;
      this.schedule();
      this.syncToggle();
    });
  }

  // Point the panel at a project. Used once on a case study, and on every tab on the home page.
  load(entry: REntry, focus: Focus): void {
    this.scene = entry.scene;
    this.focus = focus;
    this.repo = entry.repo;
    this.defaultTags = Object.fromEntries(entry.scene.nodes.filter((n) => n.tag).map((n) => [n.id, n.tag!]));
    if (this.cta) {
      this.cta.textContent = `▶ ${entry.scene.cta ?? 'Walk through it'}`;
      this.cta.dataset.umamiEventProject = entry.id;
    }
    if (this.caseLink && entry.href) {
      this.caseLink.href = entry.href;
      this.caseLink.dataset.umamiEventProject = entry.id;
    }
    if (this.repoLink) {
      this.repoLink.hidden = !entry.repo;
      if (entry.repo) {
        this.repoLink.href = entry.repo;
        this.repoLink.dataset.umamiEventProject = entry.id;
      }
    }
    this.reset();
  }

  private write(title: string, text: string, href?: string, hrefText?: string): void {
    this.title.textContent = title;
    this.title.hidden = !title;
    this.text.textContent = text;
    this.link.hidden = !href;
    if (href) {
      this.link.href = href;
      this.link.textContent = hrefText ?? href;
    }
  }

  private showControls(walking: boolean): void {
    if (this.rest) this.rest.hidden = walking;
    if (this.nav) this.nav.hidden = !walking;
  }

  private syncToggle(): void {
    if (this.toggle) {
      this.toggle.textContent = this.auto ? '❚❚' : '▶';
      this.toggle.setAttribute('aria-label', this.auto ? 'Pause' : 'Play');
    }
  }

  private schedule(): void {
    clearTimeout(this.timer);
    if (this.auto) this.timer = window.setTimeout(() => this.advance(), STEP_MS);
  }

  private advance(): void {
    const steps = this.scene.steps ?? [];
    if (this.index + 1 < steps.length) this.show(this.index + 1);
    else this.reset();
  }

  private show(i: number): void {
    const steps = this.scene.steps ?? [];
    const step = steps[i];
    if (!step) return;
    this.index = i;
    this.focus.step = step;
    this.focus.selected = null;
    this.focus.retarget();
    this.onChange({ ...this.defaultTags, ...step.tags });
    this.write(step.title, step.text);
    if (this.count) this.count.textContent = `${i + 1} / ${steps.length}`;
    this.showControls(true);
    this.syncToggle();
    this.schedule();
  }

  private manual(i: number): void {
    const steps = this.scene.steps ?? [];
    this.auto = false;
    clearTimeout(this.timer);
    if (i >= steps.length) this.reset();
    else this.show(Math.max(0, i));
  }

  play(): void {
    this.auto = true;
    this.show(0);
  }

  reset(): void {
    clearTimeout(this.timer);
    this.auto = false;
    this.index = -1;
    this.focus.step = null;
    this.focus.selected = null;
    this.focus.retarget();
    this.onChange(this.defaultTags);
    this.write('', this.scene.caption);
    this.showControls(false);
  }

  // Click a block to see what it does. Click it again, or empty space, to go back.
  select(i: number | null): void {
    if (i === null || i === this.focus.selected) {
      if (this.focus.selected !== null) this.reset();
      return;
    }
    clearTimeout(this.timer);
    this.auto = false;
    this.index = -1;
    this.focus.step = null;
    this.focus.selected = i;
    this.focus.retarget();
    this.onChange(this.defaultTags);
    const node = this.scene.nodes[i]!;
    let href: string | undefined;
    if (this.repo && node.path) {
      const isFile = /\.[a-z]+$/i.test(node.path);
      href = `${this.repo}/${isFile ? 'blob' : 'tree'}/HEAD/${node.path}`;
    }
    this.write(node.label, node.info, href, node.path ? `${node.path} ↗` : undefined);
    this.showControls(false);
  }
}
