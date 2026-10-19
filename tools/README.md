# Development tools

Run these from the repository root after `npm ci`. HTML previews are served by the local Vite development server at `/tools/<name>.html`. They are development harnesses, not production entry points.

Generated screenshots, logs, metrics, and city snapshots are ignored by Git. Their generator scripts remain in the repository:

```sh
npx tsx tools/create-regional-fixture.ts
npx tsx tools/inspect-showcase.ts
npx tsx tools/soak-city.ts
npx tsx tools/traffic-audit.ts
```

`regional-fixture.json` is a synthetic fixture included because the regional preview imports it. The soak script creates the snapshots consumed by `profile-city.ts` and `inspect-queues.ts`; check its command-line arguments before running a particular scenario. Never commit an exported personal city or credentials as a test fixture.

`recreation-preview.html` shows the actual soccer, pool, playground, park and resort models with close-up cameras, pause and reduced-motion controls. Scroll toward the pointer, use Zoom +/−, or double-click a surface to focus it. It never accesses saved cities. Use it to check articulated people, swing contact and submerged swimmers independently of the city economy.

On the soccer field, **People close-up** follows a runner. **Next player** cycles through all six players, **Follow player** releases or reattaches the camera, and **Slow motion** runs at 35% speed. Pause and reduced motion remain independent controls. Drag to orbit while following a player.

The field runs an autonomous 3-v-3 match with two outfield players and a keeper per team. **Follow ball** keeps the live action in view; **Soccer field** restores the overview. The score and recent play appear above the render statistics. Ball possession, passing, pressing, interceptions, shots and goal restarts use the same match logic in the main city.

**Night lights** switches the recreation preview between daylight and night. It uses the same facility fixtures, ground illumination and nearby light budget as the main city, including sports floodlights, pool deck/underwater lights, playground poles, park lanterns and resort bollards. Changing the preview lighting does not access saved cities.

`pedestrian-preview.html` includes a face study and a 270-person crowd view using the same anatomical rig as recreation. The bundled near/distant head data is adapted from the attributed scan documented at `public/asset-credits.html`. `node tools/prepare-human-head.mjs` rebuilds it, downloading the pinned Three.js r180 source into the ignored `.npm-cache/human-source/` directory if necessary. Normal app startup and builds use the bundled data and require no model downloads.

For serial test execution on Windows:

```sh
npx tsx --test --test-concurrency=1 src/*.test.ts
```
