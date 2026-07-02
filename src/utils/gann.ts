export function getStaticGannTargets(currentPriceRm: number, multiplier: number = 100) {
  const p = currentPriceRm * multiplier;
  let root = Math.ceil(Math.sqrt(p));
  let n = root % 2 === 0 ? root + 1 : root;

  // Sometimes if p is exactly on a lower boundary, we need the previous ring too for SL
  // So we generate crosses for n-2, n, n+2, n+4
  const rings = [Math.max(1, n - 2), n, n + 2, n + 4];
  const allCrosses = new Map<number, 'red' | 'blue'>();

  for (const ring of rings) {
    if (ring === 1) {
      allCrosses.set(1, 'red');
      continue;
    }
    const r = ring;
    
    // Bottom Right (Blue) = r^2
    allCrosses.set(r * r, 'blue');
    // Bottom (Red)
    allCrosses.set(r * r - (r - 1) / 2, 'red');
    // Bottom Left (Blue)
    allCrosses.set(r * r - (r - 1), 'blue');
    // Left (Red)
    allCrosses.set(r * r - 3 * (r - 1) / 2, 'red');
    // Top Left (Blue)
    allCrosses.set(r * r - 2 * (r - 1), 'blue');
    // Top (Red)
    allCrosses.set(r * r - 5 * (r - 1) / 2, 'red');
    // Top Right (Blue)
    allCrosses.set(r * r - 3 * (r - 1), 'blue');
    // Right (Red)
    allCrosses.set(r * r - 7 * (r - 1) / 2, 'red');
  }

  const sortedCrosses = Array.from(allCrosses.keys()).sort((a, b) => a - b);

  // Dynamic threshold: A single Gann step is approx 0.5 * sqrt(p)
  // We skip a level if the distance to it is less than 30% of a standard step size.
  const stepSize = 0.5 * Math.sqrt(p);
  const skipThreshold = stepSize * 0.3;

  let validSLs = sortedCrosses.filter(c => (p - c) >= skipThreshold);
  let staticSL = validSLs.length > 0 ? validSLs[validSLs.length - 1] : sortedCrosses[0];

  let tps = sortedCrosses.filter(c => (c - p) >= skipThreshold).slice(0, 4);

  // Fallback if not enough targets
  while (tps.length < 4) {
    tps.push(tps[tps.length - 1] + stepSize);
  }

  return {
    staticSL: (staticSL / multiplier).toFixed(3),
    staticSLColor: allCrosses.get(staticSL) || 'red',
    staticTP1: (tps[0] / multiplier).toFixed(3),
    staticTP1Color: allCrosses.get(tps[0]) || 'blue',
    staticTP2: (tps[1] / multiplier).toFixed(3),
    staticTP2Color: allCrosses.get(tps[1]) || 'red',
    staticTP3: (tps[2] / multiplier).toFixed(3),
    staticTP3Color: allCrosses.get(tps[2]) || 'blue',
    staticTP4: (tps[3] / multiplier).toFixed(3),
    staticTP4Color: allCrosses.get(tps[3]) || 'red'
  };
}
