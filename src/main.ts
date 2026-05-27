import { easeInOutQuart } from "js-easing-functions";

interface EyeOptions {
  x?: number;
  y?: number;
  size?: number;
  wideness?: number;
  topRise?: number;
  bottomDrop?: number;
  peakShift?: number;
  valleyShift?: number;
  tilt?: number;
}

const eyes: Eye[] = [];
const viewport = { x: 0, y: 0 };
const tickIntervalMs = 16;

const cacheCanvas = document.createElement("canvas");
const realCanvas = document.createElement("canvas");
const cacheCtx = cacheCanvas.getContext("2d")!;
const realCtx = realCanvas.getContext("2d")!;

let bgColor = "";

const randomInt = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomRange = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

class Eye {
  x: number;
  y: number;
  size: number;

  wideness: number;
  topRise: number;
  bottomDrop: number;
  peakShift: number;
  valleyShift: number;
  tilt: number;
  maxHeight: number;

  pX: number;
  pY: number;
  pTargetX: number;
  pTargetY: number;
  pR: number;

  blinkSpeed = 400;
  blinkStart: number | undefined = undefined;
  blinkState = 0;
  toBeDestroyed = false;

  constructor(o: EyeOptions = {}) {
    this.x = o.x ?? Math.floor(Math.random() * viewport.x);
    this.y = o.y ?? Math.floor(Math.random() * viewport.y);
    this.size = o.size ?? randomInt(50, 120);

    this.wideness = o.wideness ?? randomRange(this.size * 0.75, this.size * 1.1);
    this.topRise = o.topRise ?? randomRange(this.size * 0.45, this.size * 0.85);
    this.bottomDrop =
      o.bottomDrop ?? randomRange(this.topRise * 0.45, this.topRise * 0.8);
    this.peakShift = o.peakShift ?? randomRange(-0.45, 0.45);
    // Bottom valley tends to bias slightly opposite the top peak; keeps the
    // almond shape feeling like a real lid pair rather than two random arches.
    this.valleyShift = o.valleyShift ?? -this.peakShift * randomRange(0.3, 0.7);
    this.tilt = o.tilt ?? randomRange(-0.22, 0.22);
    this.maxHeight = Math.max(this.topRise, this.bottomDrop);

    this.pR = randomInt(10, 20);

    this.pX = this.x;
    this.pY = this.y;
    this.pTargetX = this.x;
    this.pTargetY = this.y;

    const reach = Math.hypot(this.wideness, this.maxHeight);
    if (this.x - reach < 0) this.x = reach;
    if (this.x + reach > viewport.x) this.x = viewport.x - reach;
    if (this.y - reach < 0) this.y = reach;
    if (this.y + reach > viewport.y) this.y = viewport.y - reach;

    eyes.forEach((eye) => {
      const distance = Math.hypot(eye.x - this.x, eye.y - this.y);
      const threshold =
        Math.max(eye.wideness, eye.maxHeight) +
        Math.max(this.wideness, this.maxHeight);
      if (distance < threshold) {
        eye.close();
      }
    });

    this.open();
    this.blinkStart = performance.now() - this.blinkSpeed * 0.8;
    this.blinkState = 0;
  }

  blink() {
    this.blinkStart = performance.now();
  }

  close() {
    this.blink();
    this.toBeDestroyed = true;
  }

  open() {
    this.blinkSpeed = randomInt(220, 720);
    this.blinkStart = undefined;
    this.blinkState = 1;
  }

  pupilReach(): number {
    return Math.max(
      2,
      Math.min(
        this.wideness - this.pR - 2,
        this.topRise - this.pR - 2,
        this.bottomDrop - this.pR - 2,
      ),
    );
  }

  lookAt(worldX: number, worldY: number) {
    const dx = worldX - this.x;
    const dy = worldY - this.y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.hypot(dx, dy);
    const reach = this.pupilReach();
    const intensity = Math.min(1, distance / (this.size * 5));
    const r = intensity * reach;
    this.pTargetX = this.x + Math.cos(angle) * r;
    this.pTargetY = this.y + Math.sin(angle) * r;
  }

  // Path is built in local coords (origin at eye center, x-axis along the lid).
  // Caller is responsible for the translate/rotate transform.
  private buildPath(c: CanvasRenderingContext2D, openness: number) {
    const w = this.wideness;
    const top = this.topRise * openness;
    const bot = this.bottomDrop * openness;

    const topCp1X = -w * 0.5 + this.peakShift * w * 0.4;
    const topCp2X = w * 0.5 + this.peakShift * w * 0.4;
    const botCp1X = w * 0.5 + this.valleyShift * w * 0.4;
    const botCp2X = -w * 0.5 + this.valleyShift * w * 0.4;

    c.beginPath();
    c.moveTo(-w, 0);
    c.bezierCurveTo(topCp1X, -top, topCp2X, -top, w, 0);
    c.bezierCurveTo(botCp1X, bot, botCp2X, bot, -w, 0);
    c.closePath();
  }

  draw() {
    const c = cacheCtx;
    const openness = this.blinkState;

    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.tilt);

    if (openness <= 0.02) {
      c.restore();
      return;
    }

    this.buildPath(c, openness);
    c.fillStyle = "white";
    c.fill();

    c.save();
    this.buildPath(c, openness);
    c.clip();

    // Pupil offset is tracked in world coords; rotate back into local space.
    const wdx = this.pX - this.x;
    const wdy = this.pY - this.y;
    const cosT = Math.cos(-this.tilt);
    const sinT = Math.sin(-this.tilt);
    const lx = wdx * cosT - wdy * sinT;
    const ly = wdx * sinT + wdy * cosT;

    c.fillStyle = bgColor;
    c.beginPath();
    c.arc(lx, ly, this.pR, 0, Math.PI * 2);
    c.fill();

    // Highlight is a reflection on the eyeball; it stays fixed in screen-space
    // relative to the eye, independent of where the pupil is looking.
    // The local angle compensates for the eye's tilt so the spot doesn't rotate
    // with the shape either.
    const hlScreenAngle = -0.7;
    const hlLocalAngle = hlScreenAngle - this.tilt;
    const hlDist = Math.min(this.wideness, this.topRise) * 0.5;
    const hlR = Math.max(4, Math.min(this.wideness, this.topRise) * 0.17);
    const hlx = Math.cos(hlLocalAngle) * hlDist;
    const hly = Math.sin(hlLocalAngle) * hlDist;
    c.fillStyle = "rgba(255, 255, 255, 0.95)";
    c.beginPath();
    c.arc(hlx, hly, hlR, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "rgba(255, 255, 255, 0.55)";
    c.beginPath();
    c.arc(hlx + hlR * 1.1, hly + hlR * 1.3, hlR * 0.32, 0, Math.PI * 2);
    c.fill();

    c.restore();

    c.restore();
  }

  tick() {
    this.pX += (this.pTargetX - this.pX) * 0.18;
    this.pY += (this.pTargetY - this.pY) * 0.18;

    if (!this.blinkStart) {
      if (this.blinkState !== 1) this.blinkState = 1;
      return;
    }
    this.blinkState = easeInOutQuart(
      performance.now() - this.blinkStart,
      1,
      -1,
      this.blinkSpeed,
    );
    if (this.blinkState <= 0.1 && this.toBeDestroyed) {
      eyes.splice(eyes.indexOf(this), 1);
    }
    if (this.blinkState > 1) {
      this.open();
    }
  }
}

const clear = () => {
  cacheCtx.clearRect(0, 0, viewport.x, viewport.y);
  realCtx.clearRect(0, 0, viewport.x, viewport.y);
};

const draw = () => {
  clear();
  eyes.forEach((eye) => eye.draw());
  realCtx.drawImage(cacheCanvas, 0, 0);
  window.requestAnimationFrame(draw);
};

const handleResize = () => {
  viewport.y = realCanvas.height = cacheCanvas.height = window.innerHeight;
  viewport.x = realCanvas.width = cacheCanvas.width = window.innerWidth;
};

const tick = () => {
  eyes.forEach((eye) => {
    eye.tick();
    if (eye.blinkState !== 1) return;
    if (Math.random() > 0.01) return;
    eye.blink();
  });
};

const handleMove = (e: MouseEvent | TouchEvent) => {
  e.preventDefault();
  const point: { pageX: number; pageY: number } =
    "changedTouches" in e ? e.changedTouches[0] : e;
  eyes.forEach((eye) => eye.lookAt(point.pageX, point.pageY));
};

const init = () => {
  const bgHue = randomInt(0, 359);
  bgColor = `hsl(${bgHue}, 52.3%, 58%)`;
  handleResize();
  window.addEventListener("resize", handleResize);

  const appNode = document.querySelector<HTMLDivElement>("#app")!;
  appNode.appendChild(realCanvas);
  appNode.style.backgroundColor = bgColor;

  setInterval(tick, tickIntervalMs);
  draw();

  realCanvas.addEventListener("click", (e) => {
    eyes.push(new Eye({ x: e.clientX, y: e.clientY }));
  });
  realCanvas.addEventListener("mousemove", handleMove);
  realCanvas.addEventListener("touchmove", handleMove, { passive: false });

  eyes.push(
    new Eye({
      x: viewport.x / 2,
      y: viewport.y / 2,
      size: 90,
      peakShift: 0,
      valleyShift: 0,
      tilt: 0,
    }),
  );

  let spawnInterval = 8000;
  const spawnFloor = 2000;
  const spawnStep = 500;
  const spawnLoop = () => {
    eyes.push(new Eye());
    setTimeout(spawnLoop, spawnInterval);
    spawnInterval = Math.max(spawnFloor, spawnInterval - spawnStep);
  };
  setTimeout(spawnLoop, 10_000);
};

init();
