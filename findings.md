# Findings

- The site is a static HTML/CSS/JS page with rich existing media and module switching.
- Original styling used a black NVIDIA-inspired canvas, centered hero content, several nested rounded cards, and four competing accents.
- Rendered audit showed the old hero had weak left-to-right hierarchy and too much similar visual treatment across buttons, tabs, cards, and media.
- The redesign introduces a graphite/ivory palette, a single acid-green lead accent, an editorial two-column hero on desktop, a clearer section grid, flatter media surfaces, and tighter technical labels.
- Mobile verification at a real 390px emulated viewport reports `document.documentElement.scrollWidth === 390`; the teaser and copy fit without horizontal overflow.
- User feedback: the acid green atmosphere felt too generic and the original geometric mark felt under-designed; typography also leaned too heavily into a tech product aesthetic.
- Second pass direction: remove green atmospheric gradients, use graphite plus warm gray light, reserve sage green for signal details, replace the square mark with a tactile network symbol, and pair Instrument Serif display type with NVIDIA Sans body type.
- Instrument Serif is self-hosted in `assets/fonts/` under the SIL Open Font License.
