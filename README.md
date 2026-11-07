<div align="center">

<img src="docs/images/logo.svg" width="112" alt="personal-portfolio logo">

# personal-portfolio

**My personal site. Five projects, each with a 3D render of its architecture that you can drag, click and break.**

[![Live site](https://img.shields.io/badge/live-simar--s2.github.io-f04e15?style=flat)](https://simar-s2.github.io/personal-portfolio/)
[![Astro](https://img.shields.io/badge/Astro-7-BC52EE?style=flat&logo=astro&logoColor=white)](astro.config.mjs)
[![WebGL2: no 3D library](https://img.shields.io/badge/WebGL2-no_3D_library-111827?style=flat&logo=webgl&logoColor=white)](src/render)
[![Renderer: 11 KB gzipped](https://img.shields.io/badge/renderer-11_KB_gzipped-2ea44f?style=flat)](src/render)
[![License: MIT](https://img.shields.io/badge/license-MIT-3b82f6?style=flat)](LICENSE)

<br>

<img src="docs/images/home.png" width="820" alt="The home page: my name, what I'm working on, a featured 3D render, a clock showing Vancouver time, and the start of the projects list.">

</div>

## ✨ What it does

- **Puts the projects first,** with links to the code and a case study for each one.
- **Shows each architecture in 3D.** Drag to rotate. Click a block to see what it does and jump to the file on GitHub.
- **Lets you break things.** Crash QuorumDB's leader, freeze the scheduler's leader, or follow a noisy scan through FaceMesh, one step at a time.
- **Loads fast.** The home page has no 3D code on it at all, and the renderer only loads when a render is about to reach the screen.

## 📸 Pictures

A walkthrough in progress: the leader has crashed and the other two have elected a new one.

<img src="docs/images/case.png" width="820" alt="The QuorumDB case study. The old leader's blocks are dark and marked crashed, and the two followers glow orange while they elect a new leader.">

| cluster-scheduler, in light mode | On a phone |
|---|---|
| <img src="docs/images/cluster.png" width="560" alt="The cluster-scheduler case study in light mode, with three control planes, PostgreSQL and workers packed with jobs."> | <img src="docs/images/phone.png" width="220" alt="The home page on a phone."> |

| kbsync | FaceMesh |
|---|---|
| <img src="docs/images/kbsync.png" width="400" alt="kbsync's render: a laptop in the middle, with the loop that keeps its keyboard in step with its screen."> | <img src="docs/images/facemesh.png" width="400" alt="FaceMesh's render: point clouds going through one encoder and two decoders."> |

The whole home page:

<img src="docs/images/full.png" width="620" alt="The full home page: projects, experience, things I learned, tech stack, renders, GitHub activity, walkthrough links, a large wordmark and a quote.">

## 🔬 How it works

It's a static site built with Astro, so pages are plain HTML with very little JavaScript.

The renders don't use three.js. I wrote a small WebGL2 renderer, because a 3D library would have been about 15x the size for a scene this simple.

- **One mesh.** Every block is the same rounded box, drawn with instancing. Change its corner radius and it becomes a slab, a cylinder or a sphere.
- **Six draw calls a frame:** ground, zones, shadows, blocks, wires and packets. Wires and packets are curves evaluated in the vertex shader, so moving them costs no CPU.
- **Real text.** Labels are DOM elements placed over the canvas, so they stay sharp and can be focused with a keyboard.
- **It backs off.** It stops when it's off screen or the tab is hidden, never goes above about 60 fps, and lowers its resolution if a GPU can't keep up. A still image shows first, and stays if WebGL isn't available.

A scene is plain data in [`src/scenes`](src/scenes): blocks, wires and walkthrough steps.

## 📊 Results

| | Result |
|---|---|
| Lighthouse, home page | **100** performance, accessibility, best practices and SEO |
| Lighthouse, QuorumDB page | **100** performance, accessibility and best practices |
| Home page download | 105 KiB, with 1.1 s to the largest paint |
| Renderer script | **11 KB** gzipped |
| Slowest frame, FaceMesh walkthrough | **21 ms**, with 0 frames over 25 ms |
| The same, with the CPU slowed 4x | 21 ms, with 0 frames over 25 ms |

Frames were measured on a MacBook Pro (M1 Pro, Metal) at a 1518 × 1012 canvas. Lighthouse ran against the live site with its default mobile settings.

## ⚡️ Run it

```bash
npm install
npm run dev        # http://localhost:4321/personal-portfolio/
```

To change the site:

| What | Where |
|---|---|
| My details, experience, tech stack | [`src/data/site.ts`](src/data/site.ts) |
| Case study text | [`src/content/projects`](src/content/projects) |
| 3D scenes and walkthroughs | [`src/scenes`](src/scenes) |

Anything in `[square brackets]` in `site.ts` or a case study shows up as a placeholder with a dashed outline.

After changing a scene, rebuild its still images:

```bash
npm run build && npm run preview   # in one terminal
npm run posters                    # in another
```

Pushing to `main` deploys to GitHub Pages. To use a custom domain, set `SITE_URL` and `BASE_PATH=/` in [the workflow](.github/workflows/deploy.yml).

## 📈 Analytics

Set `umamiWebsiteId` in [`site.ts`](src/data/site.ts) to turn on [Umami](https://umami.is), which uses no cookies and doesn't identify anyone. Until then, the script isn't loaded at all.

## 💡 Things I learned

- **Headless Chrome tests the wrong GPU.** By default it renders in software, so frame times mean nothing. Forcing it onto Metal gave real numbers.
- **Very tall screenshots wrap around.** My case study appeared to repeat its top section at the bottom of the page. The page was fine: the screenshot was taller than Chrome's 8,192-pixel texture limit.
- **Hidden wires still look like clutter.** Fading unused connections to 15% left a tangle on screen. Drawing them only when a step needs them made each scene readable.

## 🙏 Credits

The visual design follows [ashishgogula.in](https://www.ashishgogula.in) by Ashish Gogula, used with his permission. The projects-first structure and case study format were inspired by [anhdtrn.com](https://www.anhdtrn.com). All the code here is my own.

## 📄 License

[MIT](LICENSE)
