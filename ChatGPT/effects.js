// 彩蛋效果 - 鼠标拖尾和烟花

class Effects {
  constructor(app) {
    this.app = app;
    this.trailParticles = [];
    this.fireworkParticles = [];
    this.animationId = null;
    this.intensity = parseFloat(localStorage.getItem('effectsIntensity') || '30') / 100; // 默认30%
  }

  // 更新强度
  setIntensity(value) {
    this.intensity = value / 100;
    localStorage.setItem('effectsIntensity', value);
  }

  // 初始化效果
  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'effects-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    window.addEventListener('resize', () => this.resizeCanvas());

    // 鼠标移动事件
    document.addEventListener('mousemove', (e) => {
      if (this.app.settings.mouseTrail) {
        this.addTrailParticle(e.clientX, e.clientY);
      }
    });

    // 点击事件
    document.addEventListener('click', (e) => {
      if (this.app.settings.clickFireworks) {
        this.createFirework(e.clientX, e.clientY);
      }
    });

    this.animate();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // 添加拖尾粒子
  addTrailParticle(x, y) {
    const colors = ['#00d4ff', '#0099ff', '#00ff88', '#ff00ff', '#ffaa00'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    // 根据强度调整粒子数量 (0.3-3个)
    const count = Math.max(1, Math.floor(3 * this.intensity));

    for (let i = 0; i < count; i++) {
      this.trailParticles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 1,
        decay: 0.02 + Math.random() * 0.02, // 加快消散
        size: (1 + Math.random() * 2) * this.intensity, // 根据强度调整大小
        color: color
      });
    }

    // 限制粒子数量
    const maxParticles = Math.floor(100 * this.intensity);
    if (this.trailParticles.length > maxParticles) {
      this.trailParticles = this.trailParticles.slice(-maxParticles);
    }
  }

  // 创建烟花
  createFirework(x, y) {
    const colors = ['#ff0040', '#ff7700', '#ffdd00', '#00ff88', '#00ddff', '#9d00ff'];
    // 根据强度调整粒子数量 (20-100个)
    const particleCount = Math.floor((20 + Math.random() * 30) * this.intensity);

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = (2 + Math.random() * 3) * this.intensity;
      const color = colors[Math.floor(Math.random() * colors.length)];

      this.fireworkParticles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.012 + Math.random() * 0.008, // 加快消散
        size: (1.5 + Math.random() * 1.5) * this.intensity,
        color: color,
        gravity: 0.08
      });
    }
  }

  // 动画循环
  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 渲染拖尾粒子
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const p = this.trailParticles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.trailParticles.splice(i, 1);
        continue;
      }

      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 渲染烟花粒子
    for (let i = this.fireworkParticles.length - 1; i >= 0; i--) {
      const p = this.fireworkParticles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.fireworkParticles.splice(i, 1);
        continue;
      }

      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();

      // 添加光晕效果
      if (p.life > 0.5) {
        this.ctx.globalAlpha = (p.life - 0.5) * 0.3;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.globalAlpha = 1;
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  // 销毁效果
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
