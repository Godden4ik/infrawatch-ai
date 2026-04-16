// Ported from ExdBots — MIT licensed vendored code.
// Adjusted defaults: higher density, smaller particles, faster lifecycle for API key display.

export interface Particle {
  x: number; y: number; vx: number; vy: number
  width: number; height: number
  life: number; maxLife: number; alpha: number; maxAlpha: number
}

export interface ParticleConfig {
  density: number; minVelocity: number; maxVelocity: number
  particleLifetime: number; scale: number; textColor: string
}

const SIZE_TEMPLATES: Array<[number, number]> = [
  [1, 1], [1, 2], [2, 1], [2, 2],
]

export class ParticleManager {
  private particles: Particle[] = []
  private spawning = true
  private width: number
  private height: number
  private config: ParticleConfig
  private targetCount: number

  constructor(width: number, height: number, config: ParticleConfig) {
    this.width = width
    this.height = height
    this.config = config
    this.targetCount = Math.ceil((width * height) / (100 / config.density))
    this.initializeParticles()
  }

  private initializeParticles(): void {
    const initialCount = Math.floor(this.targetCount * 0.5)
    for (let i = 0; i < initialCount; i++) {
      const p = this.createParticle()
      const lifeFraction = Math.random()
      p.life = Math.floor(p.maxLife * lifeFraction)
      p.alpha = this.calculateAlpha(p.life, p.maxLife, p.maxAlpha)
      this.particles.push(p)
    }
  }

  private createParticle(): Particle {
    const [width, height] = SIZE_TEMPLATES[Math.floor(Math.random() * SIZE_TEMPLATES.length)]
    const scale = this.config.scale
    const angle = Math.random() * Math.PI * 2
    const speed = this.config.minVelocity + Math.random() * (this.config.maxVelocity - this.config.minVelocity)
    const vx = Math.cos(angle) * speed
    const vy = Math.sin(angle) * speed
    const variance = 0.5 + Math.random()
    const maxLife = Math.floor(this.config.particleLifetime * variance)
    const maxAlpha = 0.4 + Math.random() * 0.35
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx, vy,
      width: width * scale,
      height: height * scale,
      life: 0, maxLife, alpha: 0, maxAlpha,
    }
  }

  private calculateAlpha(life: number, maxLife: number, maxAlpha: number): number {
    const progress = life / maxLife
    if (progress < 0.2) return maxAlpha * (progress / 0.2)
    if (progress < 0.8) return maxAlpha
    return maxAlpha * (1 - (progress - 0.8) / 0.2)
  }

  update(): void {
    const toRemove: number[] = []
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      p.x += p.vx; p.y += p.vy; p.life++
      p.alpha = this.calculateAlpha(p.life, p.maxLife, p.maxAlpha)
      if (
        p.life >= p.maxLife ||
        p.x < -p.width || p.x > this.width + p.width ||
        p.y < -p.height || p.y > this.height + p.height
      ) toRemove.push(i)
    }
    for (let i = toRemove.length - 1; i >= 0; i--) this.particles.splice(toRemove[i], 1)
    if (this.spawning) {
      const deficit = this.targetCount - this.particles.length
      const spawnBatch = Math.min(deficit, Math.ceil(this.targetCount * 0.05))
      for (let i = 0; i < spawnBatch; i++) this.particles.push(this.createParticle())
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const color = this.config.textColor
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = color
      const r = Math.max(p.width, p.height) * 0.5
      ctx.beginPath()
      ctx.arc(p.x + r, p.y + r, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  stopSpawning(): void { this.spawning = false }
  hasParticles(): boolean { return this.particles.length > 0 }
  clear(): void { this.particles = []; this.spawning = false }
}
