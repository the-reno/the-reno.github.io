# Body Mechanics Simulator

A lightweight 2D rigid-body simulator for Ronu's endurance section.

## Design goals

- Plain HTML, CSS, SVG, and native JavaScript modules.
- No runtime framework or third-party physics dependency.
- Separate calculations from rendering so formulas can be validated independently.
- User-defined segment lengths and percentages of total body weight.
- Symmetrical body inputs in the first release.
- Prescribed movement rather than muscle or control-system simulation.

## Structure

```text
body-mechanics/
├── index.html
├── README.md
├── styles/
│   └── body-mechanics.css
└── scripts/
    ├── app.js
    ├── model/
    │   ├── body-model.js
    │   ├── gait.js
    │   └── mechanics.js
    └── ui/
        ├── body-form.js
        └── runner-view.js
```

## Module boundaries

- `body-model.js`: segment definitions, percentage reconciliation, and mass conversion.
- `mechanics.js`: pure mechanics functions with no DOM access.
- `gait.js`: normalized prescribed gait cycle.
- `body-form.js`: form rendering and validation feedback.
- `runner-view.js`: SVG geometry and display-only calculations.
- `app.js`: state and animation orchestration.

## Performance choices

- One `requestAnimationFrame` loop.
- SVG elements are created once and updated in place.
- No network calls, database, framework hydration, or large libraries.
- Calculation modules are small and tree-shakable if a build process is added later.
- Animation stops changing geometry while paused.

## Validation rules

- Segment percentages must sum to 100% within ±0.1%.
- Paired segment percentages are entered per side and counted twice.
- Inputs cannot be zero or negative.
- The simulator is labeled as a mechanical comparison tool, not a medical or physiological model.

## Next development steps

1. Replace the provisional sinusoidal gait with reviewed joint-angle keyframes.
2. Move all geometry into metric coordinates before mapping to SVG pixels.
3. Add central-difference velocity and acceleration calculations.
4. Add angular momentum by segment group.
5. Add synchronized Model A versus Model B comparison.
6. Add unit tests for pure functions before expanding the interface.
