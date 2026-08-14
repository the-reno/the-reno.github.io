# Body Mechanics Simulator

A lightweight 2D rigid-body model of a runner for Ronu's endurance section.

## Design goals

- Plain HTML, CSS, SVG, and native JavaScript modules.
- No runtime framework or third-party physics dependency.
- Separate calculations from rendering so formulas can be validated independently.
- Fixed reference body proportions — no user input or configuration.
- Continuous, always-running animation showing the body's primary rotational axes.
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
        └── runner-view.js
```

## Module boundaries

- `body-model.js`: fixed reference segment lengths and mass distribution.
- `mechanics.js`: pure mechanics functions with no DOM access.
- `gait.js`: normalized prescribed gait cycle.
- `runner-view.js`: SVG geometry, joint/axis rendering, and display-only calculations.
- `app.js`: animation loop orchestration.

## Performance choices

- One `requestAnimationFrame` loop, running continuously.
- SVG elements are created once and updated in place.
- No network calls, database, framework hydration, or large libraries.
- Calculation modules are small and tree-shakable if a build process is added later.

## Model notes

- The simulator is labeled as a mechanical comparison tool, not a medical or physiological model.
- Joints are rendered as hollow pivot markers to read as mechanical rotation axes (hip, knee, ankle, shoulder, elbow).
- A dashed vertical line tracks the whole-body center of mass against the ground line, visualizing the "moving balance of mass" the page describes.

## Next development steps

1. Move all geometry into metric coordinates before mapping to SVG pixels.
2. Add central-difference velocity and acceleration calculations.
3. Add angular momentum by segment group.
4. Add synchronized Model A versus Model B comparison.
5. Add unit tests for pure functions before expanding the interface.
