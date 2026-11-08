<div align="center">

<img src="docs/images/logo.svg" width="112" alt="personal-portfolio logo">

# personal-portfolio

**My personal site. Five projects, each with a 3D render of its architecture that you can drag, click and break.**

[![Live site](https://img.shields.io/badge/live-simarsingh.dev-f04e15?style=flat)](https://simarsingh.dev)
[![Astro](https://img.shields.io/badge/Astro-7-BC52EE?style=flat&logo=astro&logoColor=white)](astro.config.mjs)
[![WebGL2: no 3D library](https://img.shields.io/badge/WebGL2-no_3D_library-111827?style=flat&logo=webgl&logoColor=white)](src/render)
[![Renderer: 11 KB gzipped](https://img.shields.io/badge/renderer-11_KB_gzipped-2ea44f?style=flat)](src/render)
[![License: MIT](https://img.shields.io/badge/license-MIT-3b82f6?style=flat)](LICENSE)

<br>

<img src="docs/images/home.png" width="820" alt="The home page: my name and contact details above a large live 3D render of QuorumDB, with tabs for all five projects.">

</div>

## ✨ What it does

- **Opens on the architecture.** The home page starts with a large live 3D render that moves through all five projects by itself, until you touch it.
- **Lets you explore it.** Drag to rotate. Click a block to see what it does and jump to the file on GitHub.
- **Lets you break things.** Crash QuorumDB's leader, freeze the scheduler's leader, or follow a noisy scan through FaceMesh, one step at a time.
- **Gives each project a case study,** with results, the decisions I made and what I learned, plus links to the code.
- **Loads fast.** A still image shows right away, then the small renderer takes over.

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

<img src="docs/images/full.png" width="620" alt="The full home page: the live render, projects with small renders beside them, what I'm doing now, experience, things I learned, tech stack, GitHub activity, walkthrough links, a large wordmark and a quote.">

## 🔬 How it works

It's a static site built with Astro, so pages are plain HTML with very little JavaScript.

The renders don't use three.js. I wrote a small WebGL2 renderer, because a 3D library would have been about 12x the size for scenes this simple.

- **One mesh.** Every block is the same rounded box, drawn with instancing. Change its corner radius and it becomes a slab, a cylinder or a sphere.
- **Six draw calls a frame:** ground, zones, shadows, blocks, wires and packets. Wires and packets are curves evaluated in the vertex shader, so moving them costs no CPU.
- **Real text.** Labels are DOM elements placed over the canvas, so they stay sharp and can be focused with a keyboard.
- **Switching projects is cheap.** Shaders stay compiled and only the scene data changes, so moving between tabs doesn't stall.
- **It backs off.** It stops when it's off screen or the tab is hidden, never goes above about 60 fps, and lowers its resolution if a GPU can't keep up. A still image shows first, and stays if WebGL isn't available.

A scene is plain data in [`src/scenes`](src/scenes): blocks, wires and walkthrough steps.

## 📊 Results

| | Result |
|---|---|
| Lighthouse: performance | **99** on the home and FaceMesh pages, **100** on QuorumDB |
| Lighthouse: accessibility, best practices, SEO | **100** on all three pages |
| Home page download | 168 KiB, with 1.6 s to the largest paint |
| Renderer script | **11 KB** gzipped |
| three.js, bundled for the same features | 134 KB gzipped |
| Slowest frame, across the scenes I measured | about **20 ms**, with 0 frames over 25 ms |
| Slowest frame while switching tabs | **18 ms** |
| FaceMesh with the CPU slowed 4x | 18 ms, with 0 frames over 25 ms |

Frames were measured on a MacBook Pro (M1 Pro, Metal) at retina resolution. Lighthouse ran against the live site with its default mobile settings.

## ⚡️ Run it

```bash
npm install
npm run dev        # http://localhost:4321/
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
