type Part = { draw: number; positions: number[] };
type Vertex = [number, number, number];
type Triangle = { vertices: Vertex[]; shade: number; color: number[] };
const colors: Record<number, number[]> = {
  1: [76, 132, 171], 2: [55, 84, 116], 3: [225, 228, 222], 4: [194, 91, 86],
  6: [231, 230, 218], 8: [231, 230, 218], 10: [224, 227, 216],
  12: [229, 231, 220], 13: [244, 244, 234], 14: [45, 50, 52],
  15: [215, 174, 79], 16: [142, 101, 46], 17: [76, 132, 171], 18: [48, 68, 77],
  19: [224, 184, 88], 20: [217, 171, 71], 22: [224, 184, 88], 23: [217, 171, 71],
};
function triangles(parts: Part[]): Triangle[] {
  return parts.flatMap(part => {
    const result: Triangle[] = [];
    for (let i = 0; i < part.positions.length; i += 9) {
      const vertices = [0, 3, 6].map(j => part.positions.slice(i+j, i+j+3) as Vertex);
      const [a,b,c] = vertices;
      const u = b.map((v,k) => v-a[k]), v = c.map((x,k) => x-a[k]);
      const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      const length = Math.hypot(...n) || 1;
      const shade = .55 + .45 * Math.abs((n[0]*.3 + n[1]*-.5 + n[2]*.81)/length);
      result.push({vertices, shade, color: colors[part.draw] ?? [210,215,220]});
    }
    return result;
  });
}
export async function mountQuackersModel(root: HTMLElement): Promise<() => void> {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  let data: {before: Part[]; after: Part[]};
  try {
    const response = await fetch('/data/quackers/geometry.json');
    if (!response.ok) throw new Error(`Geometry request: ${response.status}`);
    data = await response.json();
  } catch {
    root.querySelector('[data-caption]')!.textContent = 'The 3D data could not load. The captured screenshots still show both results.';
    return () => {};
  }
  if (!root.isConnected) return () => {};
  const mesh = {before: triangles(data.before), after: triangles(data.after)};
  let pose: 'before' | 'after' = 'before';
  let yaw = -35, pitch = .12;
  const turn = root.querySelector<HTMLInputElement>('[data-yaw]')!;
  const zoom = root.querySelector<HTMLInputElement>('[data-zoom]')!;
  const wire = root.querySelector<HTMLInputElement>('[data-wire]')!;
  const draw = () => {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width*ratio); canvas.height = Math.round(height*ratio);
    context.setTransform(ratio,0,0,ratio,0,0);
    context.clearRect(0,0,width,height);
    const scale = Math.min(width/5.6, height/5.4) * Number(zoom.value)/100;
    const angle = yaw*Math.PI/180, cy = Math.cos(angle), sy = Math.sin(angle);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const project = ([x,y,z]: Vertex) => {
      // Keep a shared origin and scale: auto-fitting each pose would hide the deformation.
      x += .65; y += .55; z += 2.25;
      const horizontal = x*cy-y*sy, depth = x*sy+y*cy;
      return [width/2+horizontal*scale, height/2-(z*cp-depth*sp)*scale, depth*cp+z*sp];
    };
    const faces = mesh[pose].map(t => ({...t, projected:t.vertices.map(project)}));
    faces.sort((a,b) => b.projected.reduce((s,p)=>s+p[2],0)-a.projected.reduce((s,p)=>s+p[2],0));
    for (const face of faces) {
      const [a,b,c] = face.projected;
      context.beginPath(); context.moveTo(a[0],a[1]); context.lineTo(b[0],b[1]); context.lineTo(c[0],c[1]); context.closePath();
      context.fillStyle = `rgb(${face.color.map(v=>Math.round(v*face.shade)).join(',')})`;
      context.fill();
      if (wire.checked) { context.strokeStyle = 'rgba(25,35,45,.55)'; context.lineWidth = .5; context.stroke(); }
    }
  };
  const update = () => {
    turn.value = String(Math.round(yaw));
    root.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.pose === pose)));
    canvas.setAttribute('aria-label',`Donald’s model ${pose} the fix. Drag to orbit, or use arrow keys.`);
    draw();
  };
  root.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach(b => b.onclick = () => { pose = b.dataset.pose as typeof pose; update(); });
  turn.oninput = () => {yaw = Number(turn.value); draw();};
  zoom.oninput = draw; wire.onchange = draw;
  root.querySelector<HTMLButtonElement>('[data-reset]')!.onclick = () => {yaw=-35;pitch=.12;zoom.value='100';update();};
  let drag: {x:number;y:number} | null = null;
  canvas.onpointerdown = e => { if (e.pointerType === 'mouse' && e.button !== 0) return; drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId); };
  canvas.onpointermove = e => {
    if (!drag) return;
    yaw = ((yaw+(e.clientX-drag.x)*.5+540)%360)-180;
    pitch = Math.max(-1.2,Math.min(1.2,pitch+(e.clientY-drag.y)*.006));
    drag={x:e.clientX,y:e.clientY}; update();
  };
  canvas.onpointerup = canvas.onpointercancel = () => {drag=null;};
  canvas.onkeydown = e => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    if (e.key==='ArrowLeft' || e.key==='ArrowRight') yaw=((yaw+(e.key==='ArrowLeft'?-10:10)+540)%360)-180;
    else pitch=Math.max(-1.2,Math.min(1.2,pitch+(e.key==='ArrowUp'?.1:-.1)));
    update();
  };
  root.querySelector<HTMLElement>('[data-fallback]')!.hidden=true;
  canvas.hidden=false;
  root.querySelector('[data-caption]')!.textContent = 'Drag to rotate Donald, or focus the model and use the arrow keys.';
  root.querySelectorAll('fieldset').forEach(f=>f.disabled=false);
  const observer = new ResizeObserver(draw); observer.observe(canvas);
  update();
  return () => observer.disconnect();
}
