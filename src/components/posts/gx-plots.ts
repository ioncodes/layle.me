import * as Plot from '@observablehq/plot';

const blue = '#2864dc', red = '#e64c43';
type RenderOptions = { width?: number; document?: Document };
type FreezeOptions = RenderOptions & { frozen?: boolean; sloped?: boolean };
export type StripMode = 'skip' | 'restart' | 'fetch';
export type MarkerLocation = 'middle' | 'end';

export function freezeResult({ frozen = true, sloped = false, document }: FreezeOptions = {}) {
  return Plot.plot({
    document, width: 300, height: 260, margin: 0,
    ariaLabel: 'Blue drawn over red using the selected source of depth.',
    x: { domain: [0, 300], axis: null }, y: { domain: [0, 260], reverse: true, axis: null },
    marks: [
      Plot.rect([{ x1: 20, x2: 280, y1: 10, y2: 250 }], { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', fill: blue }),
      frozen ? Plot.rect([{ x1: sloped ? 150 : 80, x2: 220, y1: 70, y2: 190 }], { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', fill: red }) : null,
    ],
  });
}

export function depthPlot({ frozen = true, sloped = false, width = 350, document }: FreezeOptions = {}) {
  const reference = sloped ? [[0, 0.2], [1, 0.8]] : [[0, 0.75], [1, 0.75]];
  const stored = [[0, 1], [60 / 260, 1], [60 / 260, 0.5], [200 / 260, 0.5], [200 / 260, 1], [1, 1]];
  return Plot.plot({
    document, width, height: 250, marginTop: 36, marginRight: 24, marginBottom: 48, marginLeft: 40,
    style: { background: 'transparent', fontSize: '13px', fontFamily: 'inherit' },
    ariaLabel: 'Depth along the center row. Smaller values are nearer.',
    x: { domain: [0, 1], ticks: [0, 0.5, 1], label: 'screen x', labelArrow: false },
    y: { domain: [0, 1], reverse: true, ticks: [0, 0.5, 1], grid: true, label: 'depth (near → far)', labelArrow: false },
    marks: [
      Plot.line(stored, { stroke: 'var(--gx-red)', strokeWidth: 3 }),
      Plot.line(reference, { stroke: 'var(--gx-gold)', strokeWidth: 6, strokeDasharray: '4 5', opacity: frozen ? 1 : 0.3 }),
      Plot.line(frozen ? reference : [[0, 0.25], [1, 0.25]], { stroke: 'var(--gx-blue)', strokeWidth: 3 }),
    ],
  });
}

const positions = [
  { x: 0, y: 0, name: '0' }, { x: 0, y: 180, name: '1' },
  { x: 140, y: 0, name: '2' }, { x: 140, y: 180, name: '3' },
  { x: 170, y: -60, name: 'P' },
];

export function stripModel(mode: StripMode, location: MarkerLocation) {
  const stream = location === 'middle' ? [0, 1, 4, 2, 3] : [0, 1, 2, 3, 4];
  const groups: number[][] = [[]];
  for (const i of stream) {
    if (i === 4 && mode === 'skip') continue;
    if (i === 4 && mode === 'restart') { groups.push([]); continue; }
    groups[groups.length - 1].push(i);
  }
  const triangles: number[][] = [];
  for (const group of groups) for (let i = 2; i < group.length; i++) {
    triangles.push(i % 2 ? [group[i - 1], group[i - 2], group[i]] : [group[i - 2], group[i - 1], group[i]]);
  }
  const status = mode === 'skip' ? '2 triangles. The skipped record adds no corner; the strip stays connected.'
    : mode === 'fetch' ? '3 triangles. The reserved index becomes point P, adding unwanted geometry.'
    : location === 'middle' ? '0 triangles. Each restarted piece has only 2 vertices.'
    : '2 triangles. A trailing restart happens to look like a skip. Put 0xff in the middle to distinguish them.';
  return { stream: stream.map(i => i === 4 ? '0xff (SKIP)' : i).join(' · '), triangles, status };
}

export function stripPlot(mode: StripMode = 'skip', location: MarkerLocation = 'middle', { document }: RenderOptions = {}) {
  const { triangles } = stripModel(mode, location);
  const points = positions.filter((_, i) => i < 4 || mode === 'fetch');
  return Plot.plot({
    document, width: 600, height: 430, margin: 0,
    ariaLabel: 'Triangle strip assembled using the selected interpretation.',
    x: { domain: [-100, 310], axis: null }, y: { domain: [-90, 205], reverse: true, axis: null },
    marks: [
      ...triangles.map(t => Plot.line(t.map(i => positions[i]), {
        x: 'x', y: 'y', curve: 'linear-closed', fill: t.includes(4) ? '#bf3932' : blue,
        stroke: 'white', strokeWidth: 1.5,
      })),
      mode === 'restart' && location === 'middle' ? Plot.rect([{ x1: 0, x2: 140, y1: 0, y2: 180 }], {
        x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', fill: 'none', stroke: '#788693', strokeDasharray: '6 6',
      }) : null,
      Plot.dot(points, { x: 'x', y: 'y', r: 4, fill: 'white' }),
      Plot.text(points.slice(0, 2), { x: 'x', y: 'y', text: 'name', dx: -18, fill: 'white', fontSize: 22 }),
      Plot.text(points.slice(2), { x: 'x', y: 'y', text: 'name', dx: 18, fill: 'white', fontSize: 22 }),
    ],
  });
}

export function vertexPanel({ document }: RenderOptions = {}) {
  return Plot.plot({
    document, width: 180, height: 220, margin: 0,
    x: { domain: [0, 180], axis: null }, y: { domain: [0, 220], reverse: true, axis: null },
    marks: [Plot.rect([{ x1: 20, x2: 160, y1: 10, y2: 190 }], { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', fill: blue })],
  });
}
