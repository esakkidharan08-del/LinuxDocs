/**
 * IntroScene — dependency-free Canvas-2D cyberpunk scene for the LinuxDocs intro.
 *
 * A pinhole-camera renderer drawing, in world space:
 *   • inner wireframe icosahedron  — neon cyan, with a light wave sweeping the edges
 *   • outer wireframe octahedron   — neon magenta, counter-rotating
 *   • three orbital rings          — dashed "data-stream" segments + solids
 *   • ~260 energy motes            — twinkling cyan / magenta / violet particles
 *   • a Tron-style perspective grid floor (screen-space, camera-parallaxed)
 *
 * Everything animates with requestAnimationFrame; `instant` renders one static
 * frame for prefers-reduced-motion.
 */

export interface IntroSceneOptions {
  /** Reduced-motion mode: draw one static frame and never animate. */
  instant?: boolean;
}

type Vec3 = { x: number; y: number; z: number };

const TAU = Math.PI * 2;
const PHI = (1 + Math.sqrt(5)) / 2;

// Neon palette
const CYAN = { r: 0, g: 240, b: 255 };
const MAGENTA = { r: 255, g: 46, b: 151 };
const VIOLET = { r: 157, g: 78, b: 221 };
const WHITE = { r: 236, g: 244, b: 255 };

const rotateY = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
};

const rotateX = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
};

const rotateZ = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
};

const rgb = (c: { r: number; g: number; b: number }, a: number) =>
  `rgba(${c.r},${c.g},${c.b},${a})`;

function buildIcosahedron(radius: number): { verts: Vec3[]; edges: [number, number][] } {
  const raw: [number, number, number][] = [
    [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
    [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
    [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1],
  ];
  const verts = raw.map(([x, y, z]) => {
    const len = Math.hypot(x, y, z) || 1;
    return { x: (x / len) * radius, y: (y / len) * radius, z: (z / len) * radius };
  });

  const edges: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < verts.length; i++) {
    const neighbours = verts
      .map((v, j) => ({
        j,
        d: Math.hypot(v.x - verts[i].x, v.y - verts[i].y, v.z - verts[i].z),
      }))
      .filter((k) => k.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
    for (const { j } of neighbours) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, j]);
      }
    }
  }
  return { verts, edges };
}

function buildOctahedron(radius: number): { verts: Vec3[]; edges: [number, number][] } {
  const verts: Vec3[] = [
    { x: radius, y: 0, z: 0 },
    { x: -radius, y: 0, z: 0 },
    { x: 0, y: radius, z: 0 },
    { x: 0, y: -radius, z: 0 },
    { x: 0, y: 0, z: radius },
    { x: 0, y: 0, z: -radius },
  ];
  // Connect every non-opposite pair (12 edges).
  const edges: [number, number][] = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      if (i + j !== verts.length - 1) edges.push([i, j]);
    }
  }
  return { verts, edges };
}

function sampleRing(radius: number, tiltX: number, tiltZ: number, count: number): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU;
    let p: Vec3 = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 };
    p = rotateX(p, tiltX);
    p = rotateZ(p, tiltZ);
    points.push(p);
  }
  return points;
}

function spawnMotes(count: number): Vec3[] {
  const motes: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = TAU * u;
    const phi = Math.acos(2 * v - 1);
    const r = 560 + Math.random() * 780;
    motes.push({
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
    });
  }
  return motes;
}

export class IntroScene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private width = 1;
  private height = 1;

  /** Normalised pointer position in [-1, 1] used for camera parallax. */
  private mx = 0;
  private my = 0;

  private instant: boolean;
  private running = false;
  private raf = 0;
  private time = 0;

  private icoVerts: Vec3[];
  private icoEdges: [number, number][];
  private octVerts: Vec3[];
  private octEdges: [number, number][];
  private motes: Vec3[];
  private ringDash: Vec3[];
  private ringMagenta: Vec3[];
  private ringViolet: Vec3[];

  constructor(canvas: HTMLCanvasElement, options: IntroSceneOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.instant = options.instant ?? false;

    const ico = buildIcosahedron(150);
    this.icoVerts = ico.verts;
    this.icoEdges = ico.edges;
    const oct = buildOctahedron(212);
    this.octVerts = oct.verts;
    this.octEdges = oct.edges;
    this.motes = spawnMotes(260);
    this.ringDash = sampleRing(262, 0.9, 0.35, 90);
    this.ringMagenta = sampleRing(318, -0.62, 1.05, 90);
    this.ringViolet = sampleRing(352, 1.4, -0.4, 90);
  }

  resize(): void {
    const { canvas } = this;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * this.dpr);
    canvas.height = Math.round(h * this.dpr);
    this.width = w;
    this.height = h;
  }

  setPointer(nx: number, ny: number): void {
    this.mx = nx;
    this.my = ny;
  }

  start(): void {
    if (!this.ctx || this.running) return;
    this.resize();
    this.running = true;
    const loop = (now: number) => {
      if (!this.running) return;
      this.time = now / 1000;
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private render(): void {
    const { ctx } = this;
    if (!ctx) return;

    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const f = Math.min(w, h) * 0.9;
    // Faster, livelier motion than the original scene.
    const t = this.instant ? 4.2 : this.time;
    const ry = this.instant ? 0.9 : t * 0.92;
    const rx = this.instant ? 0.42 : 0.42 + Math.sin(t * 0.42) * 0.34;
    const camX = this.mx * 64;
    const camY = this.my * 34;
    const cx = w / 2;
    const cy = h / 2;

    const near = -f * 0.9;
    const far = f * 9;

    const project = (p: Vec3) => {
      const q = rotateX(rotateY(p, ry), rx);
      const scale = f / (f + q.z);
      return { x: cx + (q.x - camX) * scale, y: cy + (q.y - camY) * scale, z: q.z, scale };
    };

    // --- Tron perspective floor -------------------------------------------------
    this.drawFloor(ctx, w, h, cx, cy, camX, camY, t);

    // --- Energy motes -----------------------------------------------------------
    for (let i = 0; i < this.motes.length; i++) {
      const p = project(this.motes[i]);
      if (p.z < near || p.z > far) continue;
      const twinkle = 0.55 + 0.45 * Math.sin(t * 2.4 + i * 1.71);
      const proximity = Math.max(0.08, Math.min(1, p.scale - 0.12));
      const alpha = proximity * twinkle;
      const color =
        i % 7 === 0 ? CYAN : i % 5 === 0 ? MAGENTA : i % 9 === 0 ? VIOLET : WHITE;
      ctx.fillStyle = rgb(color, alpha * 0.5);
      ctx.beginPath();
      ctx.arc(p.x, p.y + Math.sin(t * 0.9 + i) * 3, Math.max(0.5, 1.3 * p.scale), 0, TAU);
      ctx.fill();
    }

    // --- Orbital rings ----------------------------------------------------------
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgb(CYAN, 0.5);
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -t * 72;
    ctx.beginPath();
    for (let i = 0; i < this.ringDash.length; i++) {
      const p = project(this.ringDash[i]);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const drawSolidRing = (ring: Vec3[], color: { r: number; g: number; b: number }, width: number, alpha: number) => {
      ctx.lineWidth = width;
      ctx.strokeStyle = rgb(color, alpha);
      ctx.beginPath();
      for (let i = 0; i < ring.length; i++) {
        const p = project(ring[i]);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    };

    drawSolidRing(this.ringViolet, VIOLET, 1, 0.16);
    drawSolidRing(this.ringMagenta, MAGENTA, 1.3, 0.4);

    // --- Outer octahedron shell (magenta, counter-rotating) ---------------------
    const octRy = this.instant ? -0.6 : -t * 0.58;
    const octRx = this.instant ? 0.3 : -0.28 + Math.sin(t * 0.3) * 0.2;
    const octProject = (p: Vec3) => {
      const q = rotateX(rotateY(p, octRy), octRx);
      const scale = f / (f + q.z);
      return { x: cx + (q.x - camX) * scale, y: cy + (q.y - camY) * scale, z: q.z, scale };
    };

    for (const [a, b] of this.octEdges) {
      const pa = octProject(this.octVerts[a]);
      const pb = octProject(this.octVerts[b]);
      if (pa.z < near || pb.z < near) continue;
      const wave = 0.35 + 0.65 * ((Math.sin(t * 1.7 + (a + b) * 0.7) + 1) / 2);
      const depth = (pa.scale + pb.scale) / 2;
      // two-pass neon stroke: thick soft halo + thin core
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = rgb(MAGENTA, 0.16 + 0.3 * wave);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = rgb(WHITE, (0.12 + 0.5 * wave) * Math.min(1, depth + 0.3));
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // --- Inner icosahedron core (cyan, light wave sweeping edges) ---------------
    for (const [a, b] of this.icoEdges) {
      const pa = project(this.icoVerts[a]);
      const pb = project(this.icoVerts[b]);
      if (pa.z < near || pb.z < near) continue;
      const wave = 0.3 + 0.7 * ((Math.sin(t * 1.55 + (a + b) * 0.85) + 1) / 2);
      const depth = (pa.scale + pb.scale) / 2;
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = rgb(CYAN, 0.18 + 0.26 * wave);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = rgb(WHITE, (0.2 + 0.55 * wave) * Math.min(1, depth + 0.25));
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // --- Core: magenta neon glow + chromatic split dot --------------------------
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.6);
    const core = project({ x: 0, y: 0, z: 0 });
    const glow = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 150);
    glow.addColorStop(0, rgb(MAGENTA, 0.34 * pulse));
    glow.addColorStop(0.5, rgb(VIOLET, 0.12 * pulse));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(core.x, core.y, 150, 0, TAU);
    ctx.fill();

    ctx.fillStyle = rgb(MAGENTA, 0.95 * pulse);
    ctx.beginPath();
    ctx.arc(core.x + 3.2, core.y, 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgb(CYAN, 0.95 * pulse);
    ctx.beginPath();
    ctx.arc(core.x - 3.2, core.y, 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgb(WHITE, 0.95 * pulse);
    ctx.beginPath();
    ctx.arc(core.x, core.y, 1.6, 0, TAU);
    ctx.fill();
  }

  /** Perspective neon grid floor, drawn in screen space with camera parallax. */
  private drawFloor(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    cy: number,
    camX: number,
    camY: number,
    t: number
  ): void {
    const horizon = Math.min(cy * 1.02, h * 0.5);
    const flicker = 0.85 + 0.15 * Math.sin(t * 2.8);

    // vanishing column shifts with pointer parallax for depth
    const vpX = cx - camX * 1.15;
    const vpY = horizon + camY * 1.6;

    // vertical radiating lines
    ctx.lineWidth = 1;
    for (let k = -14; k <= 14; k++) {
      const spread = k / 14;
      const topX = vpX + spread * 30;
      const botX = vpX + spread * (w * 0.8 + 120);
      ctx.strokeStyle = rgb(CYAN, 0.05 * flicker);
      ctx.beginPath();
      ctx.moveTo(topX, vpY);
      ctx.lineTo(botX, h + 60);
      ctx.stroke();
    }

    // horizontal lines — spacing accelerates toward the camera
    ctx.lineWidth = 1;
    for (let j = 1; j <= 18; j++) {
      const u = j / 18;
      const y = vpY + Math.max(1, h - vpY) * Math.pow(u, 2.5);
      const half = w * (0.16 + u * 0.9) + 60;
      const alpha = 0.02 + 0.11 * (u * u);
      ctx.strokeStyle = rgb(CYAN, alpha * flicker);
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.stroke();
    }

    // hot horizon band
    const hyp = ctx.createLinearGradient(0, vpY - 14, 0, vpY + 8);
    hyp.addColorStop(0, 'rgba(0,0,0,0)');
    hyp.addColorStop(0.5, rgb(MAGENTA, 0.16 * flicker));
    hyp.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hyp;
    ctx.beginPath();
    ctx.rect(0, vpY - 14, w, 22);
    ctx.fill();
  }
}