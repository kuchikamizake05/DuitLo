# Design tooling

- `reference/`: historical import metadata for the approved HTML prototype.
- `import-reference.py`: optional converter; run from any directory with an explicit HTML source directory. It writes generated components in `src/components/reference/` and can replace manual bindings, so inspect its output before using it on the current app.
- `preview/`: standalone local preview of the dashboard design.

Run the preview with `pnpm design:preview` from the repository root. It uses port 3200, separate from application and browser tests.

For historical imports, install `beautifulsoup4` and `tinycss2` in a Python environment, then run `python tools/design/import-reference.py --source-dir <approved-html-directory>`. The original source provenance is in `docs/design/reference-sources.md`.

The licensed institution logo catalog is in `assets/logo-library/`. Live, approved logos are served from `public/institutions/approved/`.
