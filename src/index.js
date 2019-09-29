import {
  easeInOutSine,
  easeInOutQuad,
  easeInOutCubic,
  easeInOutQuart,
  easeInOutQuint,
  easeInOutExpo,
  easeInOutCirc,
} from 'js-easing-functions';

const eyes = [];
const size = {x: 0, y: 0}; // window/canvas dimensions.

const frameTime = 16; // in ms; ~60 frames per second.

const timingFunctions = [
  easeInOutSine,
  easeInOutQuad,
  easeInOutCubic,
  easeInOutQuart,
  easeInOutQuint,
  easeInOutExpo,
  easeInOutCirc,
];

const canvas = {
  cache: document.createElement('canvas'),
  real: document.createElement('canvas'),
};

const context = {
  cache: canvas.cache.getContext('2d'),
  real: canvas.real.getContext('2d'),
};

const cleanCanvases = () => {
  context.cache.clearRect(0, 0, size.x, size.y);
  context.real.clearRect(0, 0, size.x, size.y);
};

const draw = () => {
  cleanCanvases();
  drawEyes();
  syncCanvases();
  window.requestAnimationFrame(draw);
};

const drawEyes = () => {
  eyes.forEach(eye => {
    eye.draw();
  });
};

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const handleResize = () => {
  size.y = canvas.real.height = canvas.cache.height = window.innerHeight;
  size.x = canvas.real.width = canvas.cache.width = window.innerWidth;
};

const init = () => {
  const hue = getRandomInt(0, 255);

  handleResize();
  window.addEventListener('resize', handleResize);

  document.body.appendChild(canvas.real);
  document.body.style.backgroundColor = `hsl(${hue}, 52.3%, 58%)`;

  setInterval(tick, frameTime);
  draw();
};

const syncCanvases = () => {
  context.real.drawImage(canvas.cache, 0, 0);
};

const tick = time => {
  eyes.forEach(eye => {
    eye.tick();
    if (eye.blinkState !== 1) {
      return;
    }
    if (Math.random() > 0.01) {
      return;
    }
    eye.blink();
  });
};

function Eye(o) {
  const settings = o || {};
  this.x = settings.x || Math.floor(Math.random() * size.x);
  this.y = settings.y || Math.floor(Math.random() * size.y);
  this.size = settings.size || getRandomInt(40, 120);

  this.pX = this.x;
  this.pY = this.y;
  this.pR = getRandomInt(10, 20);

  this.pointiness =
    settings.pointiness || getRandomInt(this.size / 2, this.size);
  this.wideness = settings.wideness || getRandomInt(this.size / 2, this.size);

  this.maxHeight = this.size;

  // Make sure it sits inside the viewport.
  if (this.x - this.size < 0) {
    this.x = 0 + this.size;
  }
  if (this.x + this.size > size.x) {
    this.x = size.x - this.size;
  }
  if (this.y - this.maxHeight < 0) {
    this.y = 0 + this.maxHeight;
  }
  if (this.y + this.maxHeight > size.y) {
    this.y = size.y - this.maxHeight;
  }

  // Close any overlapping eyes.
  eyes.forEach(eye => {
    const distance = Math.hypot(eye.x - this.x, eye.y - this.y);
    if (distance < eye.size + this.size) {
      eye.close();
    }
  });

  this.blink = () => {
    this.blinkStart = performance.now();
  };

  this.close = () => {
    this.blink();
    this.toBeDestroyed = true;
  };

  this.draw = () => {
    const c = context.cache;
    const maxHeight = Math.floor(this.maxHeight * this.blinkState);

    const xStart = this.x - this.wideness;
    const xEnd = this.x + this.wideness;

    const yStart = this.y;
    const yEndPos = this.y + maxHeight;
    const yEndNeg = this.y - maxHeight;

    const xCpStart = this.x - this.maxHeight + this.pointiness;
    const xCpEnd = this.x + this.maxHeight - this.pointiness;

    c.fillStyle = 'white';
    c.beginPath();
    c.moveTo(xStart, this.y);
    c.bezierCurveTo(xCpStart, yEndNeg, xCpEnd, yEndNeg, xEnd, this.y);
    c.bezierCurveTo(xCpEnd, yEndPos, xCpStart, yEndPos, xStart, this.y);
    c.closePath();
    c.fill();

    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = document.body.style.backgroundColor;
    c.beginPath();
    c.arc(this.pX, this.pY, this.pR, 0, 2 * Math.PI);
    c.closePath();
    c.fill();

    const reflectionAngle = -0.6;
    c.fillStyle = 'white';
    c.beginPath();
    c.arc(
      this.x + (Math.cos(reflectionAngle) * this.size) / 2,
      this.y + (Math.sin(reflectionAngle) * this.size) / 2,
      8,
      0,
      2 * Math.PI,
    );
    c.closePath();
    c.fill();
    c.globalCompositeOperation = 'source-over';
  };

  this.open = () => {
    this.blinkSpeed = getRandomInt(200, 800);
    this.blinkStart = undefined;
    this.blinkState = 1;
  };

  this.tick = () => {
    if (!this.blinkStart) {
      if (this.blinkState !== 1) {
        this.blinkState = 1;
      }
      return;
    }
    this.blinkState = timingFunctions[3](
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
  };

  this.open();
  this.blinkStart = performance.now() - this.blinkSpeed * 0.8;
  this.blinkState = 0;
}

init();

canvas.real.addEventListener('click', e => {
  eyes.push(new Eye({x: e.clientX, y: e.clientY}));
});

const handleMove = e => {
  e.preventDefault();
  const target = e.changedTouches ? e.changedTouches[0] : e;
  eyes.forEach(eye => {
    const angle = Math.atan2(target.pageY - eye.y, target.pageX - eye.x);
    const c = Math.hypot(eye.x - target.pageX, eye.y - target.pageY);
    const d = c / Math.max(size.x, size.y);
    const maxDistance = eye.size * 0.62;
    const distance = maxDistance * d;
    eye.pX = eye.x + Math.cos(angle) * distance;
    eye.pY = eye.y + Math.sin(angle) * distance;
  });
};

canvas.real.addEventListener('mousemove', handleMove);
canvas.real.addEventListener('touchmove', handleMove);

eyes.push(
  new Eye({
    x: size.x / 2,
    y: size.y / 2,
    pointiness: 50,
    size: 80,
    wideness: 80,
  }),
);
