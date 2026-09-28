# Training deck

Install the dependencies, then start the preview:

```bash
npm install
npm start
```

Open http://localhost:8800. Edit the chapter files under `slides/`; the browser
reloads when you save. Use the corner button to switch between light and dark.
Press `S` for speaker notes and the timer.

```bash
npm run build
npm run pdf
npm run handout
npm run agenda
npm run check
```

The build writes `index.html` and copies its dependencies into `vendor/`.
Share both together. After installation, preview, build and export use local
assets, including Mermaid, KaTeX and fonts.

PDF export writes `handout.pdf` and needs Chrome or Chromium and Node 22 or
later. Set `CHROME_PATH` if the browser is not on your PATH. The Markdown
handout includes speaker notes; the PDF contains the slides and solutions.

The example is a 30-minute workshop about planning a session. Replace its
content with your lesson. Keep shared slides in `slides/partials/` and include
them from chapter files.

Use `layout-title` and `layout-section` as slide classes. Use `two-col` for
comparisons and `layout-code` for code beside an explanation. The exercise and
solution are consecutive slides, so the answer appears when you advance and
remains available in the handout. All layouts share the light and dark themes.
