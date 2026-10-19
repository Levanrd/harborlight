# Harborlight — A Brighter City

A local browser city builder using React, TypeScript, Three.js, Vite, and Zustand. City models are procedural; people use a locally bundled anatomical head mesh with attribution. Hosting is on hold while gameplay is developed.

## Run

Use Node.js 22 or newer. From the repository root:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. `npm run build` type-checks and generates `dist`. `npm test` runs the simulation tests.

City saves stay in your browser's local storage and IndexedDB; they are not included in the repository. Publishing this source does not deploy a hosted game. The `tools/` directory contains optional development previews and simulation audits; see [tools/README.md](tools/README.md) for generated fixtures.

## Getting started

Open **http://127.0.0.1:5173/** for the single Harborlight Bay master plan. It starts paused with 1,740 residents, 259 developed lots, $650,000, all unlocks, every implemented facility type, and four bus routes. Press Play to run it. Coastal homes, apartments, resorts and a water park occupy the shoreline; homes and local services sit north of a park buffer; industry, waste and sewage facilities are south of the residential districts. Airport, cargo port and passenger rail are connected and operational.

The former town, metropolis and coastal saves are removed from active play and archived atomically in IndexedDB. Old URL bookmarks all load `masterplan-v1`. **City menu → Export archived cities** downloads recoverable copies; **Reset the master plan** archives the current city before rebuilding it. Only one city is active. Earlier release notes below describe historical versions and save behavior that this master-plan update supersedes.

You can continue developing this city: choose **Roads** and click two endpoints, then place facilities or zone **Homes**, **Shops**, and **Industry**. Construction takes three simulation days when utilities and demand allow growth. Decorative courtyards and service yards on empty parcels automatically yield to construction.

Hold the left mouse button and drag to pan; right-drag also pans. Middle-drag orbits and the wheel zooms. A short left click selects or builds. Drag gestures and holds longer than 300 ms never place a lot or start a road. Camera buttons provide top view, rotation, zoom, and night lighting. Space pauses, R selects roads, Escape cancels, and Ctrl+Z undoes construction. Keyboard shortcuts are ignored while editing a form or using a control. Click Treasury to adjust taxes; Explore selects a lot and explains its growth conditions.

## Graphics and animation

The city now has distinct procedural houses, apartments, shops, and warehouses. Houses include pitched roofs, dormers, porches, paths, and hedges. Apartments have floor bands, framed windows, glass balconies, rooftop gardens, and utility equipment. Shops have storefront glazing, striped awnings, signage, and rooftop units. Warehouses include loading doors, roof ribs, skylights, silos, and tier-specific rooftop structures. Civic buildings have additional glazing; water towers have cylindrical tanks. Trees use layered rounded crowns.

Locally generated canvas textures add stucco, brickwork, roof tiles, asphalt, paving, grass, and water detail. Warm directional sunlight, cool fill light, environment reflections, filmic tone mapping, and softer shadows give buildings more depth. A continuous beach ribbon follows the river, with animated water ripples. Night lighting fades in smoothly, illuminating selected windows, street lamps, and vehicle headlights. Night mode remains a manual toggle.

Camera buttons ease over 0.65 seconds; mouse/wheel input interrupts a camera flight immediately. Vehicle positions and steering interpolate between simulation steps. Newly placed or upgraded buildings rise into place over 0.65 seconds. The system respects the browser's reduced-motion preference for camera flights, construction reveals, lighting transitions, and water animation.

**Graphics** offers Low, Medium, High and Ultra. High caps pixel ratio at 1.75, uses 3072-pixel shadows, and adds half-resolution screen-space ambient occlusion over full-resolution scene color. Ultra uses 4096-pixel shadows. Low and Medium skip ambient occlusion. The adjacent FPS readout reports recent local rendering performance. Quality is a session setting and does not alter your saved city.

Scenery is instanced by geometry/material while preserving per-lot selection. Vehicles use reusable instance batches whose transforms update each frame. Static scenery and transit decoration are rebuilt only when their visible state changes. Geometry, materials, textures, and instance buffers are released on unmount. Graphics remain generated locally; this update adds no downloaded models, image assets, or runtime graphics services.

## City levels and milestones

Click the **LEVEL** badge in the header or **City menu → City levels & milestones**. XP comes only from successful paid residential upgrades: 100 XP for level 1 → 2, and 200 XP for level 2 → 3. Production, factory upgrades, construction, and population growth do not award XP. XP never decreases when buildings are damaged or demolished.

| City level | Total XP | Cash on reaching level | Unlocks |
| --- | --- | --- | --- |
| 1 · New beginnings | 0 | — | Homes, shops, basic factories; wood, metal, planks, nails; utility hubs, clinics, fire stations, landfills, pocket parks, transit |
| 2 · A growing neighborhood | 100 | $750 | Schools, playgrounds, stone, workshop factories |
| 3 · A connected town | 300 | $1,500 | Police stations, sports fields, bricks, level 3 home upgrades |
| 4 · An industrious city | 600 | $2,500 | Solar stations, water towers, treatment plants, recycling centers, advanced factories |
| 5 · A place to thrive | 1,000 | $5,000 | Large parks |

Cash is awarded automatically once when an upgrade crosses a threshold. Loading a save does not repay rewards. Level 5 is the current cap; XP can continue accumulating. Locked items display their required city level, and simulation actions enforce the same restrictions. The first home upgrade uses only starting materials, so progression has no material-unlock deadlock.

In the factory desk, upgrade a basic factory to a **Workshop factory** at city level 2 for $900 (four queue slots), then to an **Advanced factory** at city level 4 for $2,400 (five slots). Existing jobs keep their progress. All occupied slots produce simultaneously, each with its own timer; tiers increase concurrent production capacity and change the 3D building. Finished batches can be collected in any order and do not block other slots. Factory tiers are independent of automatic industrial building levels. Paid factory tiers cannot be reverted through construction Undo.

Old saves migrate once: each previously paid residential upgrade counts as 100 XP, without retroactive cash. Existing locked building types remain available for rebuilding; already-stocked or queued stone/bricks retain recipe access, with stone retained for bricks. Existing facilities and queues continue working. Starter towns retain their supplied school. All new empty cities start at level 1 with no retained unlocks. XP, retained access, factory tiers, and expanded queues persist in local saves and validated JSON backups.

## Materials, factories, and home upgrades

Open **Materials & upgrades** on the left or in City menu. Existing industrial lots act as factories once initial construction finishes and road-connected utilities work. Choose a factory and add up to three batches (four or five after factory upgrades). Each factory processes one batch at a time; collect finished goods to start the next batch. Factories run independently. One city day takes two seconds at 1×; pausing, closing the game, or losing utilities suspends production. There is no offline production.

| Batch output | Days | Cost | Ingredients |
| --- | --- | --- | --- |
| 2 Wood | 2 | $8 | None |
| 2 Metal | 3 | $12 | None |
| 2 Stone | 3 | $10 | None |
| 2 Planks | 3 | $20 | 2 Wood |
| 2 Nails | 4 | $24 | 2 Metal |
| 2 Bricks | 5 | $28 | 2 Stone |

Coins and ingredients are charged when a batch enters the queue. Canceling any batch refunds both, provided storage can hold the returned ingredients. City storage holds 80 total material units. Finished batches remain safely at the factory until collected; use supplies or sell individual units to free storage. Sale prices are below production costs. Factories with pending or finished batches cannot be demolished or undone until those batches are collected or canceled.

Choose **Residential upgrades** and a home, or inspect a home directly. Level 2 costs $300 plus 2 Planks, 2 Nails, and 2 Metal. Level 3 costs $1,200 plus 4 Planks, 4 Nails, and 4 Bricks. Upgrades require completed initial construction, full current occupancy, supplied utilities, happiness above 30%, and land value of at least 48 for level 2 or 65 for level 3. Level 3 also requires city level 3 and school coverage. Each upgrade adds 12 capacity and changes the building model; residents move in gradually when demand and utility headroom permit. Materials and money are consumed atomically. Paid home upgrades cannot be reversed through construction Undo.

Existing homes keep their levels. Future residential level-ups are manual; shops and industry still develop automatically. **Production & upgrades** overlay highlights factories with finished goods in gold and homes ready to upgrade in green. Factories show small crates while working. Inventory, queue order/progress, and upgrade counts persist in browser saves and validated JSON backups; old saves initialize empty production when first used.

## Emergency dispatch and traffic

Open **Traffic & dispatch** to view live calls, road queues, fleet availability, and busy road sections. The simulation starts paused after loading; choose Resume or a time speed to begin.

- **Ambulances and fire trucks:** Each supplied clinic and fire station has one unit. Dispatch selects an available reachable station using road routes weighted by traffic. Units travel to a call, work at the scene (7 seconds medical / 10 seconds fire), and return to base before accepting another call. Road removal interrupts or reroutes a response; missing utilities make a station unavailable.
- **Incidents:** Occupied lots periodically generate medical calls and fires, with frequency influenced by city health and fire risk. A real call unanswered for 150 simulation seconds removes occupants and costs $200 for medical calls or $600 for fires. Fire damage resets the building to level 1 construction. Resolved calls remain visible briefly in the log.
- **Drills:** Run ambulance/fire drills from the dispatch panel. Select an occupied lot beforehand to choose its location. Drills have no financial or building damage and use the same dispatch and travel rules. Up to four calls can be active.
- **Traffic lights:** Junctions with at least three road connections receive automatic signals. Each axis gets six seconds of green, separated by one second with all directions red. Junction reservations prevent conflicting entries.
- **Queues and congestion:** Civilian trips connect occupied homes and workplaces. Vehicles maintain a same-lane gap, wait at red signals, and avoid entering a blocked exit. Road load slows travel and affects route choice. Ambulances and fire trucks are faster but still obey signals and queues. Avenues allow faster travel. The traffic overlay shows local road load; the dashboard measures the share of vehicles currently waiting.
- **Persistence:** Saves and JSON backups include vehicles, incident states, elapsed traffic time, and response counters. Older saves initialize traffic safely. Loading pauses the city so calls do not advance before you are ready.

## Parks and recreation

Open **Parks** in the bottom toolbar to compare and place recreation:

| Facility | Footprint | Cost | Monthly upkeep | Radius | Maximum happiness / land value |
| --- | --- | --- | --- | --- | --- |
| Pocket park | 1×1 | $500 | $12 | 5 lots | +4 / +12 |
| Playground | 2×2 | $1,800 | $40 | 5 lots | +7 / +10 |
| Sports field | 3×2 | $4,200 | $100 | 7 lots | +10 / +14 |
| Large park | 3×3 | $6,500 | $150 | 9 lots | +12 / +20 |

Click selects the top-left corner on the north-up map. The preview shows the complete footprint; all lots must be empty and on buildable land, with a road touching any outside edge. Outdoor recreation needs no utility supply. Playground models include swings and a slide; sports fields include pitch markings, goals, lights, and benches; large parks include a fountain, walking paths, trees, and picnic areas. Existing pocket parks remain compatible.

Benefits decrease linearly with straight-line distance from the facility center. Nearby homes receive a local happiness bonus, and nearby lots receive land value. Overlapping facilities combine up to +12 happiness and +30 land value per lot. The city happiness bonus is weighted by affected residents; parks far from homes no longer give a flat citywide happiness bonus. Greenery also reduces pollution, capped at 30 greenery points. Removing road frontage suspends the facility's effects, and restoring frontage reopens it. Upkeep continues while disconnected.

The Parks desk shows resident reach, happiness contribution, total upkeep, facility status, and homes with the least recreation. **Recreation overlay** shows benefit strength; inspectors show local happiness and land-value contributions. The full footprint is saved as one linked facility: construction and upkeep are charged once, roads cannot overwrite any part, demolition from any member removes the whole facility for $20, and Undo restores the complete area. Save validation rejects incomplete or mismatched footprints.

## Police and neighborhood safety

Open **Police** in the toolbar to place a **Police station** for $5,200 plus $220/month. Each station operates two automatic patrol cars and requires road frontage and working power, water, and sewage. Up to eight stations are supported. Resume time after construction.

Occupied homes and workplaces build a 0–100 crime index gradually. The baseline pressure is 28 for homes, 38 for commerce, and 32 for industry. Missing utilities add 12, garbage adds up to 14, and taxes above 10% add 1.2 per percentage point. Each day the index moves 4% toward that pressure. Old saves begin at zero and develop crime when resumed.

Patrol cars choose reachable occupied lots, balancing risk, distance, and time since the last visit. They obey the existing signals, queues, and congestion. A three-second completed visit reduces crime by 10 points at lots along two connected road sections, and provides 20 days of prevention: pressure is reduced to a quarter and crime falls another half point per day. No benefit is credited on dispatch or interrupted visits. Cars avoid lots visited within five days, make up to four stops, then return to their station. Unavailable stations withdraw their cars; road changes reroute a patrol or end an unreachable trip. Coverage cannot jump disconnected roads.

Residential safety is 100 minus the population-weighted residential crime index. Crime reduces happiness by 0.2 points per index point, and reduces each occupied lot's land value by 0.12 per point. The **Police** desk reports safety, recent patrol coverage, high crime lots, happiness impact, live car status, completed visits, and priority neighborhoods. **Crime & safety** overlay uses green below 20, amber below 45, and red at 45 or higher. Inspect a lot for its crime, safety, and recent police presence. Stations and marked patrol cars have distinct 3D models. Local saves and JSON backups retain crime, patrol dates, counters, and active cars. This is an aggregate neighborhood model, without individual suspects, arrests, or jail capacity.

## Garbage collection

Open **Garbage** in the bottom toolbar to build a **Landfill** ($4,500, $180/month, two trucks) or **Recycling center** ($8,000, $320/month, three trucks). Both need road frontage and a road network with working power, water, and sewage. Place facilities away from homes. Up to eight are supported.

Occupied homes, shops, and industry generate waste each simulation day at 0.006, 0.008, and 0.012 units per occupant/job respectively. Buildup adds local pollution; 12 units per lot counts as overflow. Residential buildup applies a happiness penalty of up to 18 points, in addition to the existing pollution effects on happiness, health, and land value. Collecting garbage removes that penalty as lots become clean. Older towns start with no backlog and begin generating waste when resumed.

Trucks automatically target reachable lots with at least 0.5 units, balancing urgency and distance. They stop for 1.5 simulation seconds, pick up waste, visit further lots until their 60-unit cargo space is full or no reachable work remains, then return to unload. Trucks use the same traffic queues and red lights as other vehicles, with a larger following gap. Missing utilities suspend dispatch. Road edits reroute a trip when possible; an interrupted trip restores undelivered cargo to its source lots. Waste is not credited as delivered until a truck returns.

Landfills store up to 2,000 units permanently and produce more pollution as they fill. Recycling centers buffer up to 200 units and process up to 12 units per day with working utilities, producing much less local pollution. Incoming truck cargo reserves receiving capacity, so simultaneous deliveries cannot overfill storage. Full facilities cannot accept more pickups. **Contract haul stored waste** removes stored material for $2/unit. Stored waste must be cleared before demolishing or undoing a facility.

The garbage desk shows cleanliness, overflow, happiness penalty, generated/delivered/recycled totals, truck cargo and status, facility capacity, and priority lots. Its map buttons focus on a facility or lot. **Garbage overlay** colors lots by buildup and facilities by storage fullness; **Pollution overlay** includes waste impacts. Street bins, overflow piles, landfill heaps, recycling buildings, and collection trucks are visible in 3D. Browser saves and JSON backups retain waste amounts, processing totals, and active truck cargo. Waste uses representative simulation units rather than real tonnage.

## Public transportation

Open **Transit** in the bottom toolbar. **Place stops** adds a shelter to an existing road for $250 plus $5/month. Residents can walk up to three grid blocks to stops. Stop placement never replaces the road.

Choose **Draw route**, click a stop to begin, then click road waypoints or other stops. Segments follow connected roads; intermediate stops on the path are included. End at a different stop, name the line, choose one to three buses, and click **Open bus line**. The stop list can also add route anchors. Undo the last anchor in the editor; Escape cancels the draft. Left-drag still pans without adding route points. Routes run out and back along the drawn path. Up to six routes and 48 stops are supported.

Each bus costs $1,800 plus $90/month while its line is enabled, carries up to 24 representative commuters, and dwells for two seconds at each stop. Visible buses use their line color and obey the same signals, queues, and road congestion as cars, with a larger following gap. Riders board only in the direction of their destination and leave at that stop. Matching home/work trips can choose transit; actual boardings lower the target car load for the following minute (up to 55%), while existing cars complete their journeys. Capacity and walking coverage limit the benefit. Riders waiting over 90 simulation seconds return to car demand.

The transit desk shows boardings/car trips replaced, completed rides, waiting riders, route fleets, coverage, and upkeep. Pause or remove a line there; construction purchases are not refunded. Stops used by a line must have their lines removed first. Missing road sections suspend the affected line and produce a warning; rebuilding the gap restores service. Transit routes, fleet positions, passengers, and counters are included in browser saves and JSON backups. Old saves load without transit. This is a representative commute model, without transfers, timetables, fares, or bus depots.

## Management expansion

- **Separate utilities:** Power, water, and sewage have independent usage and capacity within each connected road network. An isolated facility cannot supply a different network. Buildings attach to one network and never bridge disconnected roads.
- **Specialized facilities:** Solar stations add 900 power units; water towers add 750 water units; treatment plants add 750 sewage units. Legacy utility hubs remain compatible and supply 500 of each. Industry uses two power units and 1.5 water/sewage units per occupied job; other zones use one of each per occupant. Facilities have construction and monthly upkeep costs.
- **Public services:** Schools, clinics, and fire stations reach 12, 16, and 18 road sections from their entrance. A facility requires a supplied road network. The dashboard reports the percentage of residents covered. Schools support level 3 homes; clinics improve the health index; fire stations lower the fire-risk indicator. All three improve land value and happiness.
- **Pollution and land value:** Occupied industry and sewage treatment pollute nearby lots. Nearby parks reduce pollution and raise land value. Heavy residential pollution blocks growth and causes residents to leave.
- **Demand-driven development:** Excess zoning reduces demand and can stop construction. Growth needs demand of at least 15, utility headroom, and sufficient happiness. Shops and industry reach level 2 at age 45 with land value 48, and level 3 at age 90 with land value 65. Homes instead use the manual material upgrades described above. Existing upgraded buildings retain their levels.
- **Management dashboard:** Open City management on the left or click the utility summary. Compare network capacities, service coverage, health, fire risk, pollution, and suggested construction. Use the facility selector above the toolbar to switch utility or service types.
- **Overlays:** Inspect utility supply, pollution, land value, or each public service's coverage directly on roads and lots.
- **Backups:** City menu exports/imports JSON backups. Import validates the file and pauses the restored city. Export before replacing a town. Existing browser saves continue to work, including their utility hubs.
- **Undo:** Construction undo refunds its original cost and changes only affected lots. Simulation days, tax settings, earned revenue, and unrelated building development are preserved.

## Existing foundation

Terrain with hills, forest, and shoreline; orthogonal road intersections; cost previews; demolition; three zones with procedural upgrades; visible road-following cars; parks; taxes and upkeep; minimap; time controls; a named new-city mode; IndexedDB save/load and 30-second autosave.

## Simulation boundaries

This remains a staged prototype. Roads snap to 12 m cells (8 rendering units) and turn at right angles. Avenues have distinct markings, higher upkeep, and greater weight in the aggregate traffic-capacity calculation. Traffic samples city journeys with up to 100 civilian cars, plus buses, garbage trucks, patrol cars, and response vehicles. It uses discrete road segments, following gaps, signal timing, and intersection reservations; it is not a full lane-changing or physics model. Population, jobs, healthcare, education, and fire protection are aggregated. Health and fire risk affect incident frequency; incidents and response are simulated at building level rather than for individual citizens. Public services currently use distance coverage rather than student/patient capacity. Electricity, water, and sewage travel through roads rather than separate pipes or cables. Road-accessible recreation provides local greenery and reduces nearby pollution immediately. Night lighting is manual. Curved roads, large disasters, and deeper industry systems remain later stages.

## Architecture

- `src/grid.ts`: shared land boundaries, cell keys, and neighbor coordinates without simulation initialization dependencies.
- `src/regional.ts` / `src/RegionalPanel.tsx` / `src/regionalModels.ts`: regional transport footprints, shared passenger/cargo demand, fees, jobs, pollution, dashboard, and animated facilities.
- `src/simulation.ts`: immutable rules, road components, utility accounting, road-distance service reach, pollution, demand, development, backup validation, and construction undo.
- `src/store.ts`: Zustand actions and IndexedDB persistence.
- `src/progression.ts` / `src/MilestonesPanel.tsx`: city XP, five milestones, one-time rewards, unlock checks, factory tiers, migration, and the level dashboard.
- `src/production.ts`: recipes, parallel factory production, inventory, cancellation/refunds, residential upgrade rules, and compatible save validation.
- `src/ProductionPanel.tsx` / `src/production.css`: materials desk, factory queues, crafting recipes, and home upgrade cards.
- `src/traffic.ts`: deterministic vehicle movement, weighted routing, signals, incident scheduling, responder lifecycle, and traffic-save validation.
- `src/recreation.ts`: facility configurations, footprints, road access, local recreation benefits, and save validation.
- `src/RecreationPanel.tsx` / `src/recreationModels.ts`: recreation desk and distinct 3D facilities.
- `src/police.ts`: neighborhood crime pressure, safety and happiness, road-connected patrol prevention, fleet lifecycle, and save validation.
- `src/PolicePanel.tsx`: police construction, neighborhood priorities, and live patrol status.
- `src/waste.ts`: daily waste generation, pollution and happiness effects, storage/processing, collection jobs, cargo accounting, and save validation.
- `src/WastePanel.tsx`: waste management, fleets, capacity, and contract hauling.
- `src/transit.ts`: stop construction, drawn route validation, walking coverage, transit costs, and compatible save decoding.
- `src/TransitPanel.tsx` / `src/transit.css`: nonmodal route editor and public transportation desk.
- `src/DispatchPanel.tsx`: live traffic and emergency desk.
- `src/World.tsx`: Three.js scene, lighting, overlays, smooth camera/traffic motion, picking, and graphics quality controls.
- `src/cityVisuals.ts`: surface textures, detailed zone models, static/vehicle instancing, and construction growth animation.
- `src/Management.tsx`: service dashboard and JSON backup controls.
- `src/main.tsx` / `src/style.css`: HUD, tools, inspector, and city menus.

Metrics are cached by immutable city state to avoid recomputing networks for each rendering consumer. Economy and development use a fixed two-second day interval. Traffic advances in 100 ms steps at the selected speed; rendering is independent.

## Verification

88 automated tests cover growth and revenue, network disconnections, independent resource loads, service reach, pollution and parks, demand, school-gated upgrades, save validation, construction undo, placement rejection, road routing, responder completion and return, fleet limits, interrupted routes, red lights, lane spacing, congestion-aware routes, pause/save behavior, and sustained traffic flow. Waste tests cover generation, pollution/happiness, pickup and unloading, conservation of waste through processing and interrupted trips, capacity reservations, contract hauling, utility/road disconnections, red signals, and compatible backups. Transit tests also cover route placement and funding, passenger boarding/dwell/capacity, red signals, reduced car load, interrupted and restored bus service, upkeep, and save compatibility. Police tests cover gradual risk, shortages and waste, happiness and land value, completed visits, expiring prevention, disconnections, interrupted visits, station demolition, signals, fleet limits, costs/undo, and old/new save compatibility. Recreation tests cover whole-footprint placement, shoreline and collision rejection, budget/upkeep accounting, outdoor road access, local distance falloff, population weighting, overlap caps, grouped demolition/undo, and legacy/footprint save validation. Production tests cover ingredient and coin accounting, parallel production, independent collection, storage capacity, refunds, utility outages, demolition/undo protection, manual upgrades, and save validation. Progression tests cover threshold boundaries, the complete first-upgrade recipe loop, one-time cash awards, construction/material locks, factory capacity and undo, legacy migration, and invalid progression saves. Visual tests additionally verify per-lot raycasting after batching, independent signal lamps, moving/hidden vehicle instances, resource replacement, and exact final transforms after construction animation. Regional tests cover grouped footprints, level and shoreline restrictions, shared demand, utility outages, independent networks, daily fee accounting, pollution, save validation, demolition/undo, and paused vehicle animation. TypeScript checking and the production build pass.

Browser playtesting verified the existing city loads, clinic placement changes coverage from 0% to 93% and adds upkeep, a solar station increases only power capacity by 900, overlays show reach, construction undo restores costs, and JSON export/import succeeds. Test buildings were undone afterward. The game remains local.

The traffic browser playtest uses a separate localhost origin to protect the main town at 127.0.0.1. Left-drag panning was verified with the road tool active and did not spend funds or begin construction.

The live dispatch playtest completed the fire drill in 17 simulation seconds and the ambulance drill in 31 seconds. Save/reload preserved 99 vehicles, 53 queued vehicles, two resolved drills, and one active response. No browser console errors were reported in the final playtest. The main saved town was not modified by these drills.


The transit browser playtest on the isolated localhost town drew two routes with 11 stops and five buses. It completed 82 rides from 114 boardings. Pausing a two-bus line removed $180/month of upkeep. Explicit save/reload retained both lines, all five buses, passenger counts, and treasury. Route undo and left-drag panning were exercised during drawing; no route point was added by a drag. No browser console errors were reported.

The garbage browser playtest used the isolated localhost town. With no collection, 57 lots overflowed and happiness fell from 86% to 64%. Adding a landfill and recycling center dispatched five trucks; they delivered 1,140 units and recycled 480, while happiness recovered to 67% with a remaining backlog. Contract hauling cleared 660 stored units for $1,320. Save/reload preserved both facilities, all five trucks, 201 units of cargo, waste amounts, and cumulative counters. The garbage overlay, 3D facility models, and inspector were checked; the inspector labels supplied facilities Operational. No console errors were reported. The original town at 127.0.0.1 was kept paused and was not modified by the playtest.

The police browser playtest used the separate localhost town. A $5,200 station added $220/month upkeep and dispatched two cars. Nine roadside visits completed; the crime overlay and lot inspector showed different neighborhood risk and safety values. The station badge and marked cars were checked in 3D. Explicit save/reload retained both active cars (2217 and 2223), their destinations and stages, nine visits, 77% residential safety, 10% recent patrol coverage, 18 high crime lots, and a 4.6-point happiness penalty. No browser console errors were reported. All test construction took place on localhost; the main 127.0.0.1 game was left paused with the Police desk open.

The recreation browser playtest used the isolated localhost town. Building a large park, sports field, and playground cost $12,500 and added $290/month upkeep. Residential reach rose from 74% to 100%, the direct recreation bonus increased from +1.5 to +9.6, and total happiness rose from 53% to 63% (including greenery effects). Demolishing a non-origin sports-field lot removed the entire six-lot field for $20; Undo restored all lots and funds. Save/reload retained all six recreation facilities, $326/month total recreation upkeep, benefit readings, and treasury. The recreation overlay, outdoor status, footprint inspector, and all three 3D models were checked. No browser console errors were reported. Test construction was confined to localhost.

The production browser playtest used the isolated localhost town. Two factories produced wood and metal, then crafted planks and nails. Spending 2 Planks, 2 Nails, 2 Metal, and $300 upgraded a home from level 1 (12/12 residents) to level 2 (12/24), without creating instant population. Switching factories and collecting batches exposed a React slot-key collision, which was fixed and rechecked. Explicit save/reload retained 2 Wood in storage, a completed Stone batch followed by queued Wood, one paid home upgrade, the upgraded home's level and occupancy, and $47,702 treasury. The city resumed paused and the browser reported no console errors. All playtesting remained on localhost, separate from the main saved town.

The milestone browser playtest migrated the isolated localhost town's earlier paid upgrade to level 2 / 100 XP without changing treasury. A $900 workshop upgrade preserved its queue and added a fourth slot. Two home upgrades increased XP to 200 then 300; the second crossed level 3 and paid exactly $1,500 once, while both upgrades charged $300 and consumed their materials. Bricks changed from level-locked to available immediately. The advanced factory remained locked until level 4. Four sequential batches were queued in the workshop and saved with level 3 / 300 XP and $50,190 treasury.
Reload preserved level 3 / 300 XP, the exact treasury balance, the workshop tier, and all four queued batches. No console errors were reported. The milestone dashboard was checked at the normal wide playtest viewport and the compact main-game viewport. The main game remained paused; all production and upgrade playtesting used localhost.

The graphics browser playtest used the isolated localhost town. Day/night transitions, smooth zoom, window/street lighting, animated water, High detail/Balanced switching, active traffic, and the congestion overlay were inspected. Clicking the batched commercial building still selected the correct lot (20 / 23) and showed its unchanged 16 jobs. An early zoom interpolation bug was caught and fixed. The paused scene reported roughly 60–70 FPS after warm-up, and active traffic around 40 FPS in High detail during this session; readings vary with camera, scene load, background work, and hardware. Graphics playtesting ran on localhost; the main 127.0.0.1 city was inspected paused without test construction.

Final browser checks reported no console errors. The graphics control and header were checked in the compact main-game panel, and the original local game was left open.

### Reference-inspired architecture pass

Level 3 residential and commercial buildings now use six coordinate-stable variants across rounded glass towers, stepped masonry crowns, offset twin wings, and slim towers with vertical fins. Shared facade and emission atlases render fine window grids and individually lit rooms. Landscaped podiums, canopies, planters, benches and roof accents complete the buildings. Existing saves, upgrade requirements, capacities and simulation rules are unchanged.

Night lighting transitions to a cooler moonlit palette with warm/cool room lights and more frequent street-light pools. Mixed conifer/broadleaf forests, occasional flowering street trees, shallow turquoise coastal water, and scaffolded construction sites add landscape detail. All art is generated locally; reference screenshots are not bundled as game assets.

Developer visual QA: open `/tools/graphics-preview.html` on the local Vite server. This development-only scene uses the actual World renderer with a disposable in-memory sample city, provides starter/mature and day/night controls, and never accesses saved games. It is excluded from the production entry points. Browser checks verified the daytime skyline, night windows/streets, and lot selection on a level 3 commercial tower. The additional geometry test checks all tower variants at positive and negative coordinates for lot containment, overlay clearance, nonmutation, and picking after instancing. All 76 tests, TypeScript, and the production build pass.

### Regional transport expansion

Open **Regional** in the construction toolbar, or **Airports, ports & rail** in the City menu.

| Facility | Unlock | Construction | Monthly upkeep | Footprint |
| --- | --- | --- | --- | --- |
| Passenger rail station | Level 2 | $12,000 | $350 | 4 x 2 |
| Cargo seaport | Level 4 | $26,000 | $650 | 3 x 3 |
| Regional airport | Level 5 | $42,000 | $900 | 6 x 4 |

Click anchors the northwest corner of an empty footprint. Connect a road to an outside edge and provide power, water, and sewage through that road network. Seaports must sit on the eastern shoreline with their eastern edge facing water. Removing any part demolishes the complete facility for $20; construction Undo restores its full footprint and funds.

Airports and stations serve population-scaled passenger demand; ports move cargo based on occupied industry. Facilities of the same type share demand. Operating facilities provide jobs and collect daily fees through the city budget. Passengers support commercial demand, cargo supports industrial demand, and rail adds a capped happiness bonus. Local pollution makes placement matter. Missing roads or utilities stops activity, jobs, fees, and benefits, while upkeep continues. The Regional desk reports capacity, current activity, status, costs, and lifetime passenger/cargo totals.

Aircraft, container ships, and trains animate with simulation speed and freeze when paused or out of service. These are automatic regional connections with aggregate daily accounting. Vehicle cycles are visual representations, not individually routed deliveries; rail tracks are included in the station footprint and custom intercity rail drawing is not implemented.

Regional browser QA used an isolated loopback origin on port 5184. All three models, facility focus/inspection, the wide dashboard, and the compact main-game dashboard were inspected. Running services reached 1,036 passengers served and 912 cargo units moved. Explicit save/reload preserved all facilities, those totals, 95 operational jobs, $8,760 projected monthly fees, and $123,502 treasury. A browser-only circular initialization issue found during QA was fixed by extracting shared grid helpers. No new browser errors appeared after the fix. The final 85-test suite, TypeScript check, and production build passed (Vite retains its existing large-bundle advisory). The main town remained paused; test construction used the separate origin.

Developer QA: `tools/create-regional-fixture.ts` produces the validated test-city JSON. On a Vite server bound to 127.0.0.1:5184, `/tools/regional-preview.html` runs the real World and Regional panel with that fixture and explicit test-save controls. The harness is development-only, refuses other ports, and is excluded from the production entry point.


### Building identities and built-out metropolis

The fixed-screen NORTH HARBOR and Willow River decorations were removed; they did not follow the map and looked like floating labels during camera movement. Residential towers now retain warm masonry, individual windows, balconies, planters, and rooftop gardens. Glass office towers remain commercial-only. Early shops are low retail buildings with striped awnings, pavement displays, cafe tables, and signs. Industry uses brick/ochre walls, loading bays, hazard posts, ribbed dark roofs, tanks, and taller banded chimneys. The geometry test now checks all three zone categories at every level for lot containment, selection clearance, and picking.

Open [Harborlight Metropolis](http://127.0.0.1:5173/?city=showcase), or choose **City menu → Open built-out test city**. The initial scenario has 3,492 residents, 350 buildings/facilities, 325 road sections, $500,000, level 5 unlocks, 19 bus stops, four lines with 12 buses, all service types, and operational air, sea, and passenger rail connections. Six factory queues and 42 stored materials are ready to try. Utility capacity has room to grow. The City Advisor has district camera shortcuts. The city starts paused; press Play to run the simulation.

The test scenario uses the separate IndexedDB slot **showcase-v1**. The original town continues to use **current**. City menu → Return to my city saves the test scenario and restores the original town. Reset test city recreates only the active test scenario. Initial loading waits for the saved town before exposing controls, preventing actions against a temporary starter city. Progress, upkeep, pollution, congestion, garbage, and incidents follow the normal game rules; this is a playable management scenario, not a permanently balanced or frozen display.

Implementation: src/showcase.ts creates the deterministic city, src/citySession.ts allowlists save slots, and src/showcase.test.ts covers infrastructure, utilities, routes, running simulation, factory collection, round-trip saves, and separation from the normal slot. Developer tool tools/inspect-showcase.ts exports a validated JSON fixture and prints scenario metrics.

Browser QA confirmed distinct home/shop/factory districts, removed floating labels, 12 active buses and passenger boardings, moving service fleets, a completed fire drill and an ambulance at its scene. Save switching restored the original town's $246,323 balance and the test city's $533,498 balance separately. The test city was then reset to its clean $500,000 starting state and left paused. All 88 automated tests, TypeScript, and the production build passed. Vite retains its existing large-bundle advisory. Everything remains local.

### Landscape, streets, lighting, and camera upgrade

This pass preserves the existing cream/green interface, simulation, and save format. The supplied references informed individual visual treatments; no reference-game assets or interface were imported.

- Surrounding terrain now has rolling hills, elevation-based rock/grass colors, patch variation, and a larger coastal backdrop. Every valid construction parcel remains level, so existing cities and placement rules still work. Trees follow terrain elevation and retain clearance around developed lots.
- Stable coordinate hashing and footprint variation reduce repeated architecture. Zoned buildings face adjoining roads; balconies, storefronts, loading bays, gardens, and rooftop details retain their existing zone identities.
- Roads have raised curbs, junction corner paving, crossing stripes on connected approaches, stop bars, lane arrows, road signs, drains, and rounded center markings at grid corners. Avenues have wider carriageways and double amber center markings.
- Vehicles use continuous corner poses on their real routes, with brake lamps, blinking indicators, varied car lengths, and inexpensive headlight glows. Small waiting crowds represent actual queued bus passengers, capped at six per stop; they disappear when passengers board or leave.
- Lighting → Auto cycle follows the persisted traffic clock: one visual day per 240 simulation seconds. Pause freezes it and faster speeds accelerate it. Daylight, Golden hour, and Night are manual overrides. Window emission, streetlight pools, sun color/direction, ambient light, fog tint, and water animation follow this clock.
- The inspector offers Focus building and a footprint outline marks the selected facility. Camera targets stay within the city and camera height clears surrounding terrain. Cinematic orbit circles the current view; dragging, scrolling, or a camera preset cancels it. Overview and Advisor can collapse and reopen. Compact HUD preserves construction, time, settings, and inspector access.
- Graphics offers Low (no dynamic shadows, 1× pixel ratio), Medium (1024 shadows, up to 1.25×), High (2048, up to 1.75×), and Ultra (4096, up to 2×). Actual ratio is capped by device pixel density. Shadows update on scene changes and at a bounded rate while time runs. Static geometry, moving vehicles, waiting passengers, and waste are separate instance layers.

Live testing found that garbage pickups could repeatedly rebuild the entire static city. Bins and landfill contents now update independently. A regression test prevents waste-only changes from changing the static scene signature; garbage overlays still refresh when their status changes.

Verification: 95 tests pass, including all existing simulation/save tests, all road connection geometries, every turn orientation, terrain/parcel compatibility, camera bounds, and lighting continuity. TypeScript and production builds pass; Vite still reports its existing bundle-size advisory. Browser checks covered all four graphics settings, day/dusk/night, panel collapse/restore, compact controls, live buses (12 active; completed rides), camera focus/orbit/drag cancellation, road construction, adjacent zoning, and both construction undos. The playtest saved and reloaded at $596,264 on day 215. Rendering was responsive after the waste fix; observed rates varied substantially between paused and running simulation and between viewport sizes, so they are not a portable performance benchmark.

Scope: roads still use the existing orthogonal graph; rounded corner visuals do not add a free-form curved-road drawing tool. Waiting passengers are not a general pedestrian pathfinding system. Regional aircraft, ships, and trains retain their documented aggregate-service behavior. Contact shading and light pools are inexpensive approximations; this pass does not add screen-space ambient occlusion, weather, or photorealistic assets. Graphics and manual lighting preferences reset on reload; city progress and the automatic lighting clock persist. Everything stays on localhost.

### Natural materials and organic vegetation

The realism pass replaces faceted crowns with smooth, irregular shared canopy meshes, layered conifers, cylindrical trunks and branches, textured foliage, and alpha-tested leaf sprays. Continuous terrain noise distributes woodland clusters and glades and varies grass color without a repeating patch pattern. Shoreline width is less uniform and water colors are subdued.

Large building volumes have subtle beveled edges. Residential rooflines vary within their existing upgrade tiers, window frames and facade bands are finer, and windows appear on both side walls. Brick, roof, and paving textures scale with physical dimensions, including instanced meshes, rather than stretching across tall buildings. Muted glazing and masonry, restrained daylight, and lower window emission reduce the toy-like finish. Shared geometry and instanced forest foliage limit draw overhead.

Verification: 97 tests pass, including canopy clearance, finite normals, geometry budget, woodland variation, and the existing simulation/save suite. TypeScript and production build pass (the existing Vite bundle-size advisory remains). Browser checks confirmed building picking, daylight/night, Low/High settings, and no rendering errors. The metropolis remains paused at day 215 with $596,264 and 3,012 residents. This is a more natural procedural art style; it does not introduce scanned assets, free-form roads, or change simulation rules/save formats. Everything remains local.

### Curved vehicle models

The road fleet now uses dedicated cached vehicle geometry rather than the building box helper. Passenger cars have lofted, tapered bodywork, sloped glazing, curved painted roofs, windscreen pillars, mirrors, wipers, handles, fender lips, circular tires and alloy hubs. Four proportions create compact, sedan, estate and crossover silhouettes. Police cars retain their livery and beacons. Buses have rounded bodywork and separate windows/doors; ambulances, fire engines and refuse trucks have individual cabs and recognizable rear equipment. Vehicle paint, glass, rubber and metal use dedicated materials rather than stucco textures.

Wheel rotation follows rendered travel distance. Brake lamps, turn signals, emergency beacons, route colors and the existing road poses remain connected to simulation state. All geometry and materials are shared and released with the renderer; live vehicles continue to use instance batches. The model changes do not alter traffic logic or save data.

Verification: 99 tests pass, covering the existing simulation suite plus fleet clearance/contact height, finite geometry, shared assets, animated wheels and lamp visibility after instancing. TypeScript and production build pass with the existing bundle-size advisory. The local-only `/tools/vehicle-preview.html` displays the exact city models at close range, supports day/night and wheel inspection, and never reads or writes saved games.

### Street life and building visits

Residents now make representative local walking trips between occupied homes, shops, jobs, schools, clinics and accessible parks. A sidewalk graph follows the actual road network, with crossings on the painted junction approaches. Walkers wait for signal clearance and nearby vehicles to clear; occupied crossings temporarily hold traffic. Removed roads or changed frontages invalidate walking routes. People depart through the building frontage, arrive at a destination, spend time inside and return. Park visitors remain visible while resting. Building door panels open as walkers approach. Actual waiting bus passengers use the same articulated human models.

Head, torso, arms, legs, shoes, skin tones and clothes are drawn in shared instance buffers. Walking poses and turns interpolate between simulation updates. Pause and speed controls apply to trips; reduced-motion mode disables limb swing and bobbing. Up to 180 local walkers and 90 visible waiting bus riders keep the rendering bounded. Street life in the city overview zooms toward a walking resident; Traffic & dispatch shows walking/visiting counts, completed visits and crossings.

Walking trips are a sample of neighborhood activity, not a one-to-one resident census or a replacement for bus passenger accounting. Their transient state restarts on load; existing city and traffic save formats remain valid. No hosting or external assets are used. `/tools/street-life-preview.html` runs a disposable neighborhood without reading or writing saves. `tools/check-street-life.ts` exercises the full metropolis with walking and vehicle traffic together: the final 180-second run completed 124 walking visits, 212 crossings and 273 car trips, with the walker cap respected.

Verification: 104 tests pass, including sidewalk connectivity, painted-crossing alignment, real frontage alignment, arrivals/return visits, pause, crossing clearance, vehicle yielding, road removal and bounded model buffers. Existing traffic, utilities, production and save tests remain green. TypeScript and production build pass; the existing Vite bundle-size advisory remains.

### Planned coastal neighborhoods and resident wellbeing

Open `http://127.0.0.1:5173/?city=coastal`, or choose **Open planned coastal city** in the city menu. The Seabreeze example has its own `coastal-v1` save; the original town and older metropolis keep their existing slots. The example starts paused with 1,764 residents, a beach water park, coastal cottages, apartments and resorts, local services, a landscaped buffer, and a southern industrial/waste campus. Three bus lines connect the neighborhoods, coast and workplaces. Airport, seaport and passenger rail remain operational.

**Neighborhoods & coast** shows population-weighted neighborhood happiness, pollution and unresolved concerns. Build beach houses at level 2, coastal apartments at level 3, and resorts/water parks at level 4. Beach buildings require coastal land and road frontage. Homes and resorts use the existing housing/jobs, production-upgrade and tax systems; the water park uses the existing recreation, land-value, footprint and upkeep systems. They are original procedural models, not photorealistic scanned assets or a separate tourism economy.

Resident thought clouds are derived from live home conditions: utilities, air pollution, garbage, crime, clinic/school/fire coverage and nearby recreation. A cloud follows a walking resident when available, otherwise their home. Click it for the affected lot and suggested remedy. A resolved issue disappears on the next update; another unresolved concern may replace it. Up to six clouds are shown without overlapping, and the panel can turn them off. Home happiness feeds the citywide happiness calculation; industrial separation and service placement now influence the individual homes that benefit or suffer. Pollution is a local score, not a calibrated emissions or wind simulation.

Verification: 122 tests pass, including coastal placement restrictions, geometry clearance, separate save slots, service and utility coverage, industry separation, live concern resolution, save round trips and undo. TypeScript and the production build pass. Browser checks verified coastal rendering, neighborhood controls, thought toggling and running simulation, with no browser errors. Everything remains local.

### Single master plan and surface-detail pass

`src/masterplan.ts` is the single scenario source; legacy factory exports delegate to it. `src/cityStorage.ts` performs transactional migration, keeps retired saves in downloadable archives, and saves only the master-plan slot. Startup exposes a retry state instead of overwriting data if loading fails. Traffic is decoded from the raw persisted save before city normalization.

Original local texture maps now provide brick courses, mortar, stucco grain, roof courses, paving joints and asphalt aggregate, with separate roughness and bump maps. New architecture details include gutters, shutters, balcony planters, condensers, rooftop ventilation, parapets, ladders and civic entrance rails. Streets add utility covers, repair patches and tactile crossings. Empty block interiors receive courtyards, benches, planting, industrial parking and fenced service yards. A timber promenade follows the shore. Shared geometry and static instance batching keep this detail bounded; none of these decorative objects changes simulation occupancy.

Verification: 128 tests, TypeScript and production build pass. New tests cover detail footprint clearance, decorative infill yielding to construction, every facility type, complete initial service coverage, absence of initial resident concerns, contained waste and vehicle turn clearance. Browser QA confirmed one active save and three archived legacy saves, the canonical local URL, daytime and nighttime rendering, High/Medium switching and running simulation with no browser errors. The production bundle retains Vite's size advisory. This is detailed original procedural game art, not photorealistic scanned content; simulation conditions continue to evolve after Play.

The extended playtest exposed a U-turn deadlock: waiting vehicles incorrectly occupied their planned departure lane while still physically on their arrival lane. Committed through traffic can now clear before the turn. Service vehicles use a connected block when available instead of repeatedly reversing after doorstep visits; drawn bus paths remain intact. The airport shuttle terminates independently from the north–south route. Four additional recycling depots sit beyond the greenbelt. Waste generation is balanced against the two-second city calendar, and contained rubbish no longer causes street-litter pollution. `tools/check-masterplan.ts` runs traffic, walking and economy together for 180 city days; the latest run ended at about 90% happiness with ongoing patrols and visits. Some crime concerns and industrial waste accumulation still require management during extended play—the city is not frozen or permanently balanced.

### Seasons and weather

Use **Seasons and weather** above the lighting control. Spring, summer, autumn and winter follow the same calendar as the city date, or can be selected manually. Automatic forecasts change every 14 city days and use the persisted city seed; winter forecasts can include snow, while summer favors clear skies. Clear, overcast, rain, thunderstorm, fog and snow can all be previewed manually in any season. Temperature is illustrative.

Seasonal foliage and terrain colors, upward-facing snow cover, wet/darker surfaces, subdued overcast light, fog visibility, wind-driven rain and drifting snow use shared materials and bounded GPU particle buffers. Snow leaves most of the road surface clear. Storms have heavier rain, stronger wind, choppier water and reduced visibility; this pass adds no thunder audio, lightning flashes, disasters or weather-driven economic penalties. Weather does not change transport or service mechanics.

Precipitation uses the persisted traffic clock: pause freezes it and speed controls accelerate it. Manual atmosphere previews work while paused. Reduced-motion mode stops particle movement and reduces its opacity. Low/Medium/High/Ultra cap precipitation at 350/800/1,500/2,000 particles. Climate choices are validated and included in city saves and exported backups; older saves default to automatic settings without migration or resetting the city.

Verification: 133 tests, TypeScript and production build pass. New coverage checks calendar boundaries, deterministic seasonal forecasts, all 24 manual season/weather combinations, old-save compatibility, invalid settings, save/tick preservation, particle clock/quality/reduced-motion behavior, and composition with existing physical texture shaders. Browser QA checked winter snow, autumn rain, storms, fog, manual controls while paused, running precipitation, and saved winter/snow settings after reload with no browser errors. Vite retains its existing large-bundle advisory.

### Performance and traffic reliability

City-wide pollution metrics now prepare the emitting waste facilities and overflowing bins once per calculation instead of enumerating all cells for every lot. A 20-update benchmark on the same synthetic congested-city snapshot averaged 398 ms before and 35 ms after; serialized metrics were identical. This measures CPU statistics calculation, not overall FPS. Road rebuilds also calculate traffic loads once. Paused park animations retain their instance buffers, and pedestrian/door buffers stop uploading after interpolation settles. Movement, construction changes and resume invalidate those caches.

Service vehicles now find a complete forward route to their destination when circling a block. The previous loop-plus-suffix approach could introduce another reversal mid-route. Pending old service reversals replan on connected roads; their assignment and cargo remain intact. Buses leave turning clearance for a leading bus, and already-stacked terminal arrivals from older saves turn in a deterministic order. Drawn bus routes, signals, pedestrian clearance and service work remain active.

Verification: 138 tests, TypeScript and the production build pass (the existing large-bundle advisory remains). `tools/soak-city.ts 720 final` simulates 360 city days with traffic, walking, garbage, police and the economy together; automatic incidents are disabled in this reproducible soak, while emergency dispatch has separate regression tests and was observed resolving a call in browser QA. The run completed 1,077 civilian trips, 239 patrol visits, 434 walking visits and 61 bus deliveries; its final longest vehicle wait was 23.6 seconds, with no overflowing bins. All generated waste was accounted for across bins, trucks, storage and processing, and city/traffic saves decoded successfully. Happiness ended at 94%, with eight resident concerns: service coverage still requires management as conditions evolve.

A separate 240-second recovery run loaded the pre-fix snapshot containing 33 vehicles waiting over 30 seconds. None remained above that threshold at the first 60-second checkpoint; cargo and waste conservation passed without deleting or teleporting vehicles. Browser QA kept the existing city, winter/snow settings and infrastructure, verified walking/traffic, pause and a resolved medical response, and found no console errors. Everything remains local.


## Weather gameplay and separate clocks

The calendar now advances one day per 120 active seconds at 1×, with a 300-second option under Seasons & weather → Calendar pace. The displayed hour and automatic lighting share that calendar. Automatic forecasts retain their deterministic 14-day periods (up to 28 minutes at the default pace); calendar seasons change over months. Manual weather selections remain available while paused.

Factories use a separate one-second work clock: wood 4s; metal, stone and planks 6s; nails 8s; bricks 10s at 1×. Changing calendar pace never changes these durations. Construction/development still advances every two active seconds; initial zone construction takes about six seconds with adequate demand and utilities. Taxes, waste generation/processing, crime and regional daily accounting follow calendar days. Global pause freezes everything and 2×/4× accelerate both clocks; there is no offline production. Fractional clock progress and pace persist through saves and JSON backups. Legacy production jobs migrate from day units to their equivalent seconds once.

Rain, storms, fog and snow reduce all road vehicle speeds to 80%, 60%, 70% and 65%, respectively, and increase following gaps. This includes ambulances, fire trucks, buses, patrols and collection trucks. Emergency deadlines still use active seconds, so weather can matter to response outcomes. Outdoor trip targets fall to 55%, 20%, 65% and 35%; people spend longer indoors and walk more carefully. Existing walkers finish their routes rather than disappearing. Park visitors leave early during storms and snow, using the normal sidewalk routes. Long-term park land value/coverage benefits remain unchanged.

Validation: timing tests cover both calendar paces, construction, pause, midnight settlement, persisted fractional progress and old queue migration. Weather tests cover traffic progress, an actual ambulance response/return, fewer pedestrian trips and park departures. `tools/weather-soak.ts` runs the complete master plan for 120 active seconds each in clear weather, storm and snow, checking waste conservation, save decoding and continued traffic movement. Automatic incidents are disabled for that comparison; emergency weather response has a separate test.


## Road maintenance and weather response

Road maintenance is available in the city overview and city menu. Depots cost $3,800, need road-connected utilities, and operate 1/2/3 trucks at 50/100/150% funding. Monthly costs are $140/$240/$340 per depot; standby costs $40 and recalls deployed crews. Emergency priority favors clinic/fire/police frontages; industry favors factory access; avenues also receive preference. The auto-site button only builds on vacant supplied roadside parcels, never replacing existing construction. Fresh master plans include two depots; existing cities are preserved and can add their own.

Snow accumulates at 0.1 points per active second; storms/rain add 0.025/0.01 wear per second, and dry wear is 0.003. Snow melts at 0.3 points per second outside snowfall. Snowplows clear only segments they physically traverse, including the return trip. Dispatch weighs severity before distance so nearby minor work does not starve faraway severe damage. For pavement repairs, crews reach the affected segment, work for four seconds at standard funding, repair that segment and directly connected neighbors, then return to the depot. Road conditions affect route cost and speed; repairs do not eliminate the weather visibility limit. Funding changes and outages return crews safely, and deleted roads invalidate assignments. State and live fleets survive saves. Severe local road conditions create resident concerns and reduce neighborhood happiness; recovery removes those effects.

The road-condition overlay updates once per simulation second without rebuilding static scenery. Orange service trucks use shared rounded models, amber beacons, salt hoppers and plows. Management dialogs now provide their own pause/resume button, so the blocked background time controls are no longer needed while a dialog is open. The construction toolbar has not gained another category.

Validation for maintenance: 153 tests, TypeScript and production build pass. New tests cover accumulation/thaw/pause, physical dispatch and return, utility failures, disconnected roads, budget recall without mid-segment snapping, priorities without distant-road starvation, local plowing, save validation and model clearance. The 180-second snowy master-plan soak completed 12 worksite jobs, 170 civilian trips and six bus deliveries, ending at 69% average condition with no severe roads and a valid save round trip. Browser QA added two vacant-lot depots to the existing city, verified 56 completed jobs and recovery to 97% condition, used the dialog pause control, and saved the recovered city. Vite retains its existing large-chunk advisory.

## Garbage recovery

Garbage trucks prioritize overflowing bins before smaller pickups. Only another garbage truck reserves a collection target; police patrols no longer suppress a garbage pickup at the same building. Collection health in the Garbage panel distinguishes missing utilities, full receiving storage and trucks waiting in traffic. Where utilities are missing, Add missing utilities plans power, water and sewage on vacant parcels in the affected road network, prefers distance from homes, shows the cost, and leaves modest capacity headroom. It never replaces existing lots, erases waste, or partially spends money when the full repair cannot be built. Disconnected facilities require a road repair first. Existing paid storage hauling remains manual.

Validation: 157 tests, TypeScript and production build pass. The recovery soak starts with missing power and 55 overflowing residential lots; nine power stations restore supply for $27,000 and trucks clear all overflow within 120 active seconds. The 360-second run preserves waste accounting and validates city/traffic backups. The inspected browser save was older than the reported screenshot and already supplied; its updated Collection health panel was verified, but the newer user's city was not overwritten.

## Road and lighting detail

Road surfaces now have subtle aggregate, cracks and weathering, with concrete gutters, curb joints, grated drains, muted lane paint and double-yellow avenue center lines. Stop bars are on incoming lanes. Streetlights use tapered metal poles, curved arms and slim LED housings; soft ground illumination is supplemented by a bounded pool of nearby spotlights (0/2/4/6 at Low/Medium/High/Ultra).

Traffic signals have three separate lenses, visors, backboards and pole hardware. Each direction receives five seconds green, one second amber and one second clearance before the opposing direction starts. Vehicles and visible lamps use the same phase calculation: new entries stop on amber, while committed vehicles clear the junction. Static furniture is batched and active signal lenses are instanced. Existing cities receive the visual changes without resetting their layout.

Validation: 159 tests, TypeScript and production build pass. Placement tests cover all road connection masks and both road widths; signal tests verify amber/clearance timing and prevent conflicting greens. Local browser checks verified daylight/night rendering with the existing snowy city and no console errors. The existing large-bundle build advisory remains.

## Colorful city dashboard

The HUD uses a coastal blue Harborlight identity with gold treasury coins, blue population figures, green happiness, and purple storage/progression. Original SVG illustrations remain paired with text labels and live values. The storage counter opens Materials & upgrades, and its inventory, recipes and home requirements use recognizable material illustrations. Construction tools have distinct category colors and visible selection borders. Management panels share the new palette.

Small screens retain all four resource counters and scroll the construction toolbar horizontally. `tools/hud-responsive.html` provides 390/820/1200-pixel iframe previews for local layout checks. TypeScript and production build pass; browser checks cover desktop, tablet and phone layouts, treasury/storage shortcuts, the road selector and console errors. No simulation rules or save format changed.

## Pedestrian detail

Pedestrians use shaped clothing, fuller connected limbs, rounded shoes, facial features, varied hair, glasses and backpacks. Body proportions, skin tones and outfits vary deterministically by pedestrian ID. Walking uses fixed-length legs with a planted stance and lifted swing, opposite arm motion, and a gradual return to standing when waiting. Sidewalk queue and bus-stop spacing allow for the wider silhouettes. Existing routes, crossings, visits and sliding entrance doors remain active.

The crowd uses four instanced character batches plus one door batch. Facial detail appears within 45 rendering units and clothing/accessory details within 90 rendering units; zooming while paused refreshes these levels. Settled paused buffers are retained, and reduced-motion mode uses a neutral pose. `tools/pedestrian-preview.html` offers a close-up, lineup, pause control and 270-person stress view without touching saves. That isolated crowd rendered at approximately 62 FPS on the test machine with six total scene draw calls including its ground/grid; this is not a full-city FPS guarantee. The street-life harness also verified building visits and crossings with no console errors.

Validation: 163 tests, TypeScript and production build pass. Tests cover fixed limb lengths, stance contact, deterministic variety, maximum crowd capacity without missing parts, camera-dependent detail while paused, reduced motion and opening doors. The existing bundle-size advisory remains.

## Building families & directory

Open Building directory from the city overview or City menu. Nine categories organize homes, shops/offices, industry, education/care, emergency services, transportation, beach/leisure, parks and utilities. Search family names or descriptions, filter categories, and use Find in city to select an existing example. Multi-lot facilities are counted once and focused at their center. The lot inspector displays the same family and architectural description. Unfinished zones are excluded from developed-building counts.

Seven new procedural designs replace selected residential, office and industrial variants: courtyard residences, garden terraces, wraparound veranda residences, tapered lantern towers, sky-garden offices, sawtooth warehouses and silo-based process works. Family selection is deterministic by lot and level, preserving existing saves, functions and pedestrian entrance positions. New models include their own details to avoid attaching the old facade's floating railings or equipment. All families remain bounded to their parcels and use shared scenery batches.

The local-only tools/building-preview.html gallery renders actual zone geometry without reading or writing saved cities. Validation: 166 tests pass, including parcel bounds, roof clearance, batched selection, deterministic classification and multi-lot directory counts. TypeScript and the production build pass; the existing bundle-size advisory remains. Browser checks cover the model gallery, category filtering, search, Find in city and inspector identity with no console errors.

## Simulated upgrade construction

Residential upgrades and factory expansions are prepaid, persistent projects rather than instant level changes. Homes take 20/35 active seconds for levels 2/3; factories take 30/45 seconds for tiers 2/3. Automatic commercial and industrial development uses the same timed phases. The calendar pace does not affect project or material production speed. Pausing, closing the app or losing road-connected utilities pauses work. Existing occupancy/capacity and factory queues stay available; new capacity, queue slots and residential XP arrive once at handover.

Sites show staged scaffolding, structural frames, facade protection, safety barriers, supplies, a hard-hat worker and a cable-supported hoist. Static equipment joins the shared scenery batches; workers and hoists use a separate instanced layer. Streets and frontage paths remain clear. Geometry refreshes only at phase boundaries, not every progress tick. Reduced-motion settings stop crew/hoist animation. The inspector and production panels show stage, percentage and paused/waiting status, with a View construction site shortcut.

Repeat upgrade clicks, demolition and undo cannot bypass an active paid project. Saves retain and validate remaining work; old saves still load. Fire damage cancels work on a destroyed building. The local tools/construction-preview.html playtest uses a disposable town, supports stage stepping and fixture serialization, and never accesses city saves. Validation: 172 tests pass, including exact-once costs/rewards, slot handover, save validation, calendar-independent timing, utility outages, parcel clearance and geometry refresh behavior. Browser checks verified home/factory handover, staged visuals and save/reload progress without console errors. The existing production bundle-size advisory remains.

## Simultaneous factory production

All 3–5 occupied factory slots now work in parallel, with independent 4–10 active-second timers. Completed batches remain available for manual collection and occupy their own slot without blocking other work. Collect any ready batch in any order; adding a replacement batch leaves existing timers unchanged. Costs, ingredients, refunds, storage limits, pause behavior and utility requirements still apply.

Existing sequential saves load without resetting goods or progress. Later jobs start progressing on the next active second. Saves also retain partially finished and completed jobs in any slot. Ready-batch counts, factory selectors, production overlay and individual cargo crates reflect every slot.

Validation: 175 tests pass, including five simultaneous batches, out-of-order collection, duplicate clicks, utility outages, full storage, independent timer persistence and ready-state geometry refresh. TypeScript and production build pass with the existing bundle-size advisory. The local tools/production-preview.html fixture exercises the actual production panel and store without accessing saved cities.

## Traffic diagnosis and dashboard safe areas (2026-10-20)

Pedestrian protection now checks the occupied crosswalk segment and vehicle approach direction rather than freezing every vehicle on both adjacent road cells. Traffic already leaving the crossing can clear; approaching traffic still yields. Dispatch reports waits for signals, pedestrians, traffic ahead and turning clearance, plus completed trips and longest current wait. The HUD explicitly distinguishes paused and running simulation. Cities still reopen paused.

Measured HUD boundaries keep the lot inspector above the toolbar, the overview above the minimap and the advisor above weather controls. Graphics, lighting and weather controls stack above the resource/clock panels; narrow screens raise the clock above the toolbar. Long content scrolls within each panel. Browser checks covered 1907x920, 1280x720, 1024x768 and 390x844; the open inspector had 12px toolbar clearance at 1280x720. tools/dashboard-preview.html provides repeatable viewport checks.

Scale audit: road/lot spacing is 8 world units; car bodies are 1.1 wide and 2.1–3.0 long, buses 1.65 wide and 4.4 long (vehicleModels.ts). Pedestrians use approximately human-height geometry with 0.91–1.06 height variation (pedestrianModels.ts / pedestrianAppearance.ts); residential floor spacing can be 2.15 units (cityVisuals.ts). Vegetation varies by planting context. This is mixed stylized scale, not a consistent real-world scale. No model resizing was applied in this fix. A future scale pass should coordinate vehicle size, lane width, following gaps, turning envelopes, building entrances and plot footprints together.

Verification: 177 tests pass with --test-concurrency=1 (the initial concurrent run hit an environment esbuild spawn EPERM). Targeted tests protect occupied crosswalks, clear departing vehicles and verify wait reasons/save compatibility. A six-minute deterministic master-plan simulation completed 462 car trips and 325 pedestrian visits after the change, versus 455 and 256 before; ordinary queues still occur. This does not establish the exact cause in the user's separate browser session. The supplied screenshot's 16 FPS also indicates visibly choppy rendering on Ultra.


### Physical proportion pass — October 20

The everyday rendering convention is now 1 world unit = 1.5 metres, keeping the existing 8-unit parcel coordinates and city backups unchanged. This fixes relative model sizes; it does not expand or reset the map. Adult models render about 1.6–2.0 m tall, private cars are 3.8–4.8 m long and 1.8 m wide (excluding mirrors), and the bus represents a compact 6.6 m city shuttle. Pedestrian speed is converted from metres per second, and gait distance is compensated for each person's height so planted feet do not slide.

Cars, lane centres, edge paint, door openings, single-storey houses, shelter roofs, traffic-signal housings, café/park seating and young-tree trunk thickness were reconciled against this scale. Fire/recycling stations have two wider garage doors with truck clearance. Apartment floor spacing remains about 3.2 m; established tree canopies retain their varied heights. Shared instancing and facial detail remain in place.

Traffic following gaps use both vehicle body lengths plus bumper space. Signal stopping now places the front bumper behind the stop bar. Crossing admission uses one window every two signal cycles, followed by a clearing wave, so slower pedestrians cannot repeatedly occupy the same direction's entire green interval. Saved vehicles already beyond the new stop line continue forward rather than teleport backwards.

Verification: 183 tests passed serially, TypeScript and Vite build passed (existing large-bundle warning). Tests measure rendered adult/fleet bounds, doorway headroom, opposing mirror clearance, paved U-turn envelopes, planted walking feet, boundary-to-boundary following gaps, and crossing-wave clearance. A deterministic six-minute masterplan run completed 441 car trips and 194 pedestrian visits; the final longest queue wait was 17.1 s. This is a representative traffic check, not a guarantee of zero congestion or collision-free physics.

Local previews: /tools/scale-preview.html compares actual model proportions without loading saves; /tools/street-life-preview.html exercises the actual walking/traffic systems in a disposable neighborhood without running its economy. Browser views showed populated streets and no console errors. Screenshots: tools/proportions-comparison.png and tools/proportions-street.png.

Remaining realism limits: these are procedural stylized models. Airports, ports, sports facilities and district capacity remain compressed gameplay representations; the road graph still uses right-angle cells and kinematic turns. Fully physical large facilities and steering would require larger multi-parcel assets, a larger map, and a lane/turning-radius simulation.

## Automated checks

[Harborlight CI](.github/workflows/ci.yml) runs on pull requests, pushes to main,
and manual dispatch. Three independent checks use Node.js 22 on Ubuntu 24.04:

- **Tests:** `npm run test:ci` runs every test serially, including the isolated IndexedDB regressions.
- **TypeScript:** `npm run typecheck` checks source without emitting files.
- **Production build:** `npm run build` type-checks and builds the production bundle.

Each job installs package-lock.json with `npm ci`; npm downloads are cached by
lockfile. No repository secrets, browser saves or deployed environment are needed.
To reproduce the checks locally, run `npm ci` followed by the three commands above.
The existing large-bundle warning is advisory. CI does not deploy the game.
Branch protection is separate: configure these check names as required in GitHub
if merges should be blocked until they pass.

### People in recreation areas — October 20

Soccer players, swimmers and swing riders now use articulated human figures with shaped torsos, faces, hair, hands and connected limbs at the existing human scale. Team shirts, shorts, socks and boots distinguish the soccer players; a correctly sized ball passes across the field. Swimmers wear swimwear and follow separate lap loops with alternating arm strokes and kicks. Recessed pool floors and translucent water show the submerged bodies. The shallow pool has child visitors.

Children sit on scaled swings with their hands on the chains. Seated visitors occupy park, playground, sports and resort seating; a large-park visitor follows the garden path. Elbows and knees preserve limb lengths through poses. All activity figures use shared geometry and instance batches, pause with the city and hold a fixed pose under reduced motion. These remain procedural game characters and representative leisure animations, rather than physical sports or swimming simulations. The local `/tools/recreation-preview.html` study provides close-up checks without accessing saved cities.

### Natural character anatomy and movement — October 20

Street pedestrians and recreation visitors now share an anatomical model with tapered upper arms, forearms, thighs and calves, shaped palms and fingers, fitted shoes, a ribcage and pelvis. The head is adapted from the licensed Lee Perry-Smith / Infinite-Realities scan, with locally fitted hair, skin colors, eye sockets and blinking. Credits and the CC BY 3.0 link are available in City menu → Character model credits and at `/asset-credits.html`. The head is cropped, rescaled and reduced into near and distant geometry; all assets are bundled locally.

Walking uses lower foot clearance, opposing arm swing, shoulder/pelvis counter-rotation and restrained breathing. Jogging on the sports field and walking along park paths now drive gait from actual path distance; park visitors slow and turn at path ends. Limbs retain their lengths and seated feet meet the actual ground height. The fixed instance budget is sixteen crowd/door batches; character detail falls with distance. The faces share one scan base with deterministic colors and proportions, and activities remain procedural animations rather than captured human motion. `/tools/pedestrian-preview.html` provides a face study and a 270-person crowd view; `/tools/recreation-preview.html` shows the same anatomy in leisure activities.
Verification: 193 serial tests, TypeScript and the production build passed. Browser checks covered the face study, active swimming and the 270-person crowd (16 scene draw calls including the preview ground and grid; approximately 63 FPS during this isolated check). This is not a full-city performance guarantee. The existing production bundle-size advisory remains.

### Close camera inspection — October 20

The city camera now permits a three-metre target distance with lower ground clearance for closer inspection of facilities. Repeated zoom-button presses accumulate their requested distance during camera animations. In Explore, double-click a surface to move closer and center it, including individual parts of the soccer field and airport. The recreation preview also has explicit zoom buttons, cursor-directed wheel zoom and double-click surface focus.

### Continuous limbs and jogging — October 20

Arms and legs now use continuous surfaces with two-bone skinning through elbows and knees. Rounded shoulders, anatomical limb taper, covered ankles and relaxed fingers replace the separate rigid limb pieces. Clothing colors travel with the skin; the shadow pass uses the same deformation. Street crowds retain fixed instance batches, with fourteen geometry/door batches independent of crowd size.

Soccer players have a distinct distance-driven jog, with shorter stance, heel recovery, foot roll, torso lean, shoulder counter-rotation and opposing bent-arm swing. Hands face inward and the head counters torso motion. Walking, seated and swimming poses share the new limb surfaces. These remain procedural game characters and animations; this does not add motion capture, cloth simulation or match AI.

The recreation preview's People close-up follows a selected soccer player. Next player cycles through the six players; Slow motion runs at 35% speed. The same models and poses render in the main city.

Verification: 196 serial tests passed; the affected character, scale and parcel tests passed again after the final shape and wrist refinements. TypeScript and the production build pass. Browser checks covered soccer player follow, next-player selection, slow motion, pause, swimming and the 270-person street crowd, with no rendering errors reported in either preview. The existing bundle-size advisory remains.

### Autonomous soccer — October 20

Sports fields now run a small 3-v-3 match, with two outfield players and a goalkeeper on each side. Carriers dribble and pass under pressure; teammates run into space, defenders press or mark, and keepers cover the goal. Free balls can be received, intercepted or won in a tackle. Players wind up and swing through passes and shots, turn toward their target, track the ball with their head and react to receiving it. The ball rolls, bounces and scores across the goal line, followed by a short return to kick-off.

Match updates use a fixed 60 Hz visual clock independent of render rate and freeze when the city is paused. Matches are local visual activity rather than persisted league or city-economy state. The preview adds Follow ball and a score/event line alongside player follow, slow motion and pause. This is simplified small-sided play, without full football rules, referee or human player controls.

Verification: all 199 serial tests, TypeScript and the production build pass. Tests cover frame-rate-independent decisions, pause/reset, controlled-ball reach, field bounds, passes, receptions, turnovers, shots, saves, goals and boot contact at release. Browser checks confirmed live play and a scored goal, ball-follow, slow motion and pause without reported rendering errors. The existing bundle-size advisory remains.

### Lighting throughout the city — October 20

Every building and facility type now has dedicated exterior lighting. Homes, shops and civic buildings get forecourt lanterns; industry, utilities and service yards get floodlights. Parks have path lanterns and bollards, playgrounds have perimeter lamps, sports fields have four floodlight towers, and pools/resorts have deck and underwater lighting. Airport apron floodlights and forecourt lamps complement the existing runway lights, with blue taxiway markers added. Ports have yard floodlights and railway platforms have downlights. Road corners, dead ends and isolated tiles now receive street lamps too.

Fixture housings are instanced, light pools remain visible across the city, and nearby illumination shares the existing street-light budget: zero/two/four/six real spotlights at Low/Medium/High/Ultra. Bulbs and light pools fade with the existing day/night cycle, including while the simulation is paused. This adds visual fixtures without changing construction costs, utility accounting or saves. The recreation preview includes a Night lights toggle.

Verification: all 203 serial tests and the production build pass. Lighting tests cover every building type, footprint roots, physical parcel clearance, pitch/pool/runway clearance, day/night fading and fixed batching cost. The lighting tests passed again after final park and yard placement adjustments. Browser checks covered the full city, coast, airport, soccer field, pools, playground, park and resort at night without reported rendering errors. The existing bundle-size advisory remains.
