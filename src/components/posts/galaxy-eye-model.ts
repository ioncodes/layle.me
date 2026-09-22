type Part = { material: 'body' | 'cap' | 'eyes'; vertices: number[] };
type Mesh = { buffer: WebGLBuffer; count: number; wire: WebGLBuffer; wireCount: number; material: Part['material'] };

/** Captured GX geometry; this viewer deliberately uses simple lighting, not a GX emulator. */
export async function mountGalaxyHead(root: HTMLElement): Promise<() => void> {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
  const caption = root.querySelector<HTMLElement>('[data-caption]')!;
  if (!gl) { caption.textContent = 'The 3D view needs WebGL. The screenshot above shows the same missing eyes.'; return () => {}; }
  const abort = new AbortController();
  const vertex = `attribute vec3 position; attribute vec2 uv; attribute vec3 normal;
    uniform vec2 rotation; uniform float aspect; uniform float zoom; uniform float lift;
    varying vec2 texcoord; varying float light;
    vec3 turn(vec3 p) {
      float c=cos(rotation.x),s=sin(rotation.x),a=cos(rotation.y),b=sin(rotation.y);
      vec3 q=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
      return vec3(q.x,a*q.y-b*q.z,b*q.y+a*q.z);
    }
    void main() {
      vec3 p=turn(position+vec3(0.,0.,lift));
      gl_Position=vec4(p.x*zoom/aspect,p.y*zoom,-p.z*.18,1.);
      texcoord=uv;
      light=.62+.38*max(0.,dot(normalize(turn(normal)),normalize(vec3(.2,.5,1.))));
    }`;
  const fragment = `precision mediump float; varying vec2 texcoord; varying float light;
    uniform sampler2D tex; uniform bool outline; uniform bool highlight;
    void main(){
      if(outline) gl_FragColor=vec4(1.,.65,.28,1.);
      else if(highlight) gl_FragColor=vec4(vec3(.98,.59,.2)*light,1.);
      else gl_FragColor=vec4(texture2D(tex,texcoord).rgb*light,1.);
    }`;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const error=gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(error || 'Shader compile failed'); }
    return shader;
  };
  let program: WebGLProgram | null = null;
  const buffers: WebGLBuffer[] = [], textures: WebGLTexture[] = [];
  const dispose = () => { abort.abort(); buffers.forEach(b=>gl.deleteBuffer(b)); textures.forEach(t=>gl.deleteTexture(t)); if(program)gl.deleteProgram(program); };
  try {
    const response = await fetch('/data/galaxy-eyes/head.json', {signal:abort.signal});
    if (!response.ok) throw new Error('Model could not load');
    const data: {parts: Part[]} = await response.json();
    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve,reject)=> { const im=new Image(); im.onload=()=>resolve(im); im.onerror=()=>reject(new Error('Texture could not load')); im.src=src; });
    const images=await Promise.all(['body','eye-open'].map(name=>loadImage(`/images/galaxy-eyes/${name}.png`)));
    if(!root.isConnected) { dispose(); return ()=>{}; }
    const vs=compile(gl.VERTEX_SHADER,vertex), fs=compile(gl.FRAGMENT_SHADER,fragment);
    program=gl.createProgram()!; gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Model shader could not link');
    gl.useProgram(program);
    const meshes: Mesh[]=data.parts.map(part=> {
      const buffer=gl.createBuffer()!;buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(part.vertices),gl.STATIC_DRAW);
      const lines:number[]=[];
      for(let i=0;i<part.vertices.length;i+=24) for(const j of [0,1,1,2,2,0])lines.push(...part.vertices.slice(i+j*8,i+j*8+8));
      const wire=gl.createBuffer()!;buffers.push(wire);gl.bindBuffer(gl.ARRAY_BUFFER,wire);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lines),gl.STATIC_DRAW);
      return {buffer,count:part.vertices.length/8,wire,wireCount:lines.length/8,material:part.material};
    });
    for(const image of images) {
      const tex=gl.createTexture()!;textures.push(tex);gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
    const attributes=['position','uv','normal'].map(n=>gl.getAttribLocation(program!,n));
    const uniforms=Object.fromEntries(['rotation','aspect','zoom','lift','outline','highlight','tex'].map(n=>[n,gl.getUniformLocation(program!,n)]));
    const turn=root.querySelector<HTMLInputElement>('[data-turn]')!, zoom=root.querySelector<HTMLInputElement>('[data-zoom]')!;
    const wire=root.querySelector<HTMLInputElement>('[data-wire]')!, highlight=root.querySelector<HTMLInputElement>('[data-highlight]')!, lift=root.querySelector<HTMLInputElement>('[data-lift]')!;
    let yaw=0,pitch=0,fixed=false,disposed=false;
    const bind=(b:WebGLBuffer)=> { gl.bindBuffer(gl.ARRAY_BUFFER,b);for(let i=0;i<3;i++){gl.enableVertexAttribArray(attributes[i]);gl.vertexAttribPointer(attributes[i],[3,2,3][i],gl.FLOAT,false,32,[0,12,20][i]);} };
    const draw=()=> {
      if(disposed||!root.isConnected)return;
      const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
      const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
      gl.uniform2f(uniforms.rotation,yaw*Math.PI/180,pitch);gl.uniform1f(uniforms.aspect,w/h);gl.uniform1f(uniforms.zoom,.59*Number(zoom.value)/100);gl.uniform1i(uniforms.tex,0);
      for(const mesh of meshes) {
        const eye=mesh.material==='eyes';gl.uniform1f(uniforms.lift,eye?Number(lift.value)/100:0);
        gl.uniform1i(uniforms.highlight,eye&&highlight.checked?1:0);gl.uniform1i(uniforms.outline,0);
        gl.bindTexture(gl.TEXTURE_2D,textures[eye?1:0]);
        if(!eye||fixed){bind(mesh.buffer);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
        if(eye&&wire.checked){gl.uniform1i(uniforms.outline,1);bind(mesh.wire);gl.drawArrays(gl.LINES,0,mesh.wireCount);}
      }
    };
    const update=()=> {
      turn.value=String(Math.round(yaw));
      root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.mode==='fixed')===fixed)));
      canvas.setAttribute('aria-label',`Mario's captured head. ${fixed?'Eyes visible':'Eye surfaces discarded'}. Use arrow keys to rotate.`);
      draw();
    };
    const on=(el:EventTarget,event:string,handler:EventListener)=>el.addEventListener(event,handler,{signal:abort.signal});
    root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>on(b,'click',()=>{fixed=b.dataset.mode==='fixed';update();}));
    on(turn,'input',()=>{yaw=Number(turn.value);draw();});on(zoom,'input',draw);on(wire,'change',draw);on(highlight,'change',draw);on(lift,'input',draw);
    on(root.querySelector('[data-reset]')!,'click',()=>{yaw=0;pitch=0;zoom.value='100';lift.value='0';update();});
    let drag:{x:number;y:number}|null=null;
    on(canvas,'pointerdown',event=>{const e=event as PointerEvent;if(e.button!==0)return;drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
    on(canvas,'pointermove',event=>{if(!drag)return;const e=event as PointerEvent;yaw=((yaw+(e.clientX-drag.x)*.45+540)%360)-180;pitch=Math.max(-1.2,Math.min(1.2,pitch+(e.clientY-drag.y)*.005));drag={x:e.clientX,y:e.clientY};update();});
    on(canvas,'pointerup',()=>{drag=null;});on(canvas,'pointercancel',()=>{drag=null;});
    on(canvas,'keydown',event=>{const e=event as KeyboardEvent;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft'||e.key==='ArrowRight')yaw=((yaw+(e.key==='ArrowLeft'?-10:10)+540)%360)-180;else pitch=Math.max(-1.2,Math.min(1.2,pitch+(e.key==='ArrowUp'?.1:-.1)));update();});
    on(canvas,'webglcontextlost',()=>{canvas.hidden=true;root.querySelector<HTMLElement>('[data-fallback]')!.hidden=false;root.querySelectorAll('fieldset').forEach(f=>f.disabled=true);caption.textContent='The 3D context was lost. The captured screenshot remains available.';});
    canvas.hidden=false;root.querySelector<HTMLElement>('[data-fallback]')!.hidden=true;root.querySelectorAll('fieldset').forEach(f=>f.disabled=false);
    caption.textContent='Captured game geometry with simplified lighting.';
    const resize=new ResizeObserver(draw);resize.observe(canvas);update();
    return ()=>{disposed=true;resize.disconnect();dispose();};
  } catch { dispose(); caption.textContent='The interactive model could not load. The screenshot shows the captured result.';return ()=>{}; }
}
