# Human History mode

A playable historical-scenario foundation, not a complete historical geopolitical atlas.

## Starts

10,000 BCE (regional human communities), 3000 BCE (early states), 500 BCE
(classical powers), 1200 (medieval powers), 1444 (late medieval opening),
1836 (industrial age), January 1914, January 1936, 1960, and 2000.

Each start has selectable factions with different regional holdings and political
descriptions. Military formations, simulated population and resource balances are
game values, not estimates of historical armies, GDP or census populations.
Government labels describe the opening; they do not yet implement distinct
constitutional mechanics.

## Implemented

- Real Earth coastline geometry; 44 selectable strategic locations, pan and zoom.
- Faction control, terrain, supply and accessible route overlays.
- Ten starting scenarios and ten technology tiers.
- Variable time steps, BCE/CE formatting without year zero, bounded to 2025.
- Continuous alternate history: ownership and founding factions persist across eras.
- Era-gated research, formations, production and maritime routes.
- Contact-gated trade and declarations of war; five-turn armistices.
- Taxation, recruitment, infrastructure, forts, civilian relief and army transfers.
- Logistics, attrition, morale, unrest, local autonomy, and rule-based rival decisions.
- Territorial or peaceful development victory.
- A separate validated local save; legacy fictional saves are not deleted.

## Deliberate limits

Markers represent control of selected centers, not exact national borders.
Unrepresented locations have independent regional actors rather than a single
worldwide neutral state. These actors are gameplay placeholders, not claims that
historical societies or political structures were absent.

Modern coastlines are reused in every era. No paleocoastline reconstruction is
provided. Prehistoric communities are regional abstractions, not invented named
states. Periodization is a game abstraction, not universal synchronized development.

Historical events are not scripted to override player decisions. In particular,
January 1914 and January 1936 are not automatically treated as the onset of world
war, and the Cold War does not begin with a direct US–Soviet war. The initial
diplomatic layer is simplified; it does not reconstruct every ongoing conflict.
There are no ideological bonuses or extremist insignia. Exact borders, demographic
reconstruction, complete worldwide rosters, scripted dynastic succession and detailed
government simulation remain future work.

## References and provenance

References establish broad period/faction context; they do not validate every
gameplay statistic or every simplified control marker. Text in the game is original
summary text, not copied source prose.

- [The Met chronology](https://www.metmuseum.org/toah/chronology): regional historical context.
- [The Met: Achaemenid Empire](https://www.metmuseum.org/essays/the-achaemenid-persian-empire-550-330-b-c): Persian chronology and extent.
- [The Met: Ming dynasty](https://www.metmuseum.org/essays/ming-dynasty-1368-1644): Ming chronology.
- [Neolithic Revolution](https://en.wikipedia.org/wiki/Neolithic_Revolution): prehistoric transition and uncertainty.
- [Industrial Revolution](https://en.wikipedia.org/wiki/Industrial_Revolution): industrial period context.
- [World War I](https://en.wikipedia.org/wiki/World_War_I), [World War II](https://en.wikipedia.org/wiki/World_War_II), [Cold War](https://en.wikipedia.org/wiki/Cold_War): modern-era chronology.
- [Natural Earth public-domain terms](https://www.naturalearthdata.com/about/terms-of-use/).
- Earth basemap: `ne_110m_land.geojson`, source blob `04811d72fff2701ec67587e30ad8942675b511e3`
  from `nvkelso/natural-earth-vector`; projected to equirectangular coordinates at
  3 SVG units/degree, rounded to 0.1 SVG unit. Antarctic polygons omitted from the
  playable viewport. No national-boundary data or disputed sovereignty labels are
  drawn by the basemap.

## Development

Edit `src/history-data.mjs`, `src/history-engine.mjs`, `src/history-ui.js` and
`src/earth-map.mjs`. Run `node scripts/build-history.mjs` to regenerate the inline
bundle in `public/music-studio.html`. The widget remains self-contained for MCP
embeds and requires no remote map tiles, runtime CDN or additional package.

Run `npm test`. Tests enforce bundle synchronization and cover every opening
faction, all era boundaries, research/naval gates, battles, diplomacy, logistics,
save validation, terminal states and denied browser storage.
