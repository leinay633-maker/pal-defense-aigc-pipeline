# Notice

This repository separates runnable code from project evidence.

- Source code and documentation are covered by the MIT license in `LICENSE`.
- Meshy task summaries, generated preview images, and source file inventories are included to make the Pipeline data flow inspectable.
- Full Unity project files, model binaries, editor caches, and third-party source assets are not included.
- The generated evidence files should not be treated as a reusable asset pack.

If you want to refresh evidence from a local Unity project, use:

```powershell
npm run refresh:evidence -- --unity-root "<path-to-local-unity-project>"
npm run verify
```
