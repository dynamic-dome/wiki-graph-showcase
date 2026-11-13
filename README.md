# wiki-graph-showcase

A static 3D knowledge graph built from my own Obsidian notes. **Live: https://wiki.dynamic-dome.com/**

Two datasets, rendered with three.js and 3d-force-graph: a competence graph on agentic engineering (the default) and a curated astrophysics nebula. Two visual themes (Crab Nebula, Dynamic Dome) and a "Gold Mode" slider that lets the edges pulse with the density of the graph. Click a node to open its summary.

## What it shows

- **Notes in, public site out.** A Python build reads a private Markdown vault, keeps only the pages matched by the config, drops pages marked `private: true`, resolves wikilinks and typed links, and writes `graph.json` plus one small JSON file per node. The browser loads node details lazily.
- **A gate before every deploy.** `tools/pre_deploy_sweep.py` scans the built site and fails on internal paths, secret or private markers, status notes and pipeline jargon that should not leave the notes. It runs before every deploy.
- **Static and strict.** No server code, a Content Security Policy in `_headers`, one shared three.js instance instead of two bundled copies.
- **Tested.** 138 pytest tests for the build and the sweep, Node unit tests for the frontend modules, Playwright tests for the rendered pages.

## How it works

```
Markdown vault  ->  tools/build.py  ->  dist/ (graph.json, nodes/*.json, assets)  ->  Cloudflare Pages
```

| Path | What it is |
|---|---|
| `tools/build.py` | Build orchestrator: select pages, parse, extract titles and summaries, emit JSON |
| `tools/parser.py`, `tools/filter_slice.py`, `tools/extract_page_meta.py` | Link resolution, page selection, page metadata |
| `tools/pre_deploy_sweep.py` | The deploy gate described above |
| `src/` | Frontend: HTML, CSS and ES modules (scene, themes, Gold Mode, detail panel, URL state) |
| `showcase.config.json`, `kompetenz.config.json` | Which pages go into each dataset; `vault_root` is relative to the repository root |
| `docs/` | Architecture, capabilities, changelog, audits (mostly in German) |

## Run it

The real graphs are built from private vaults that are not part of this repository, so a clone builds only with a vault of your own. Point `vault_root` in a config at any folder of Markdown notes, then:

```bash
npm install
npm run build              # python -m tools.build --config showcase.config.json --out dist/
npm run serve:preview      # http://127.0.0.1:8051
npm run sweep              # the deploy gate
npm run test:py            # pytest, uses small fixture vaults
```

Python 3.11+ with the standard library is enough for the build; Node is needed for the preview tooling and the Playwright tests.

## License

[MIT](LICENSE). The note contents shown on the live site are mine and not covered by this license.
