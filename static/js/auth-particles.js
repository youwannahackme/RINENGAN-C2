/**
 * WHOAMI_404 // RINENGAN C2 - Visual Background Engine (Hyper-Fusion Edition)
 * High-performance GPU-accelerated HTML5 Canvas engine combining:
 * - Rising Chakra Flame Embers & Hot Sparks
 * - Interactive Cyber Constellation Nodes & Mesh
 * - Atmospheric Nebula Glow Orbs
 * - Interactive Shockwave Physics & 2.5D Parallax
 */

class AuthBackgroundEngine {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) return;

        this.options = Object.assign({
            emberCount: 65,
            nodeCount: 48,
            orbCount: 4,
            maxConnectionDist: 130,
            mouseRadius: 160,
            enableParallax: false
        }, options);

        this.width = 0;
        this.height = 0;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        this.themeRgb = [255, 59, 92]; // Default crimson/red for img-1.jpg
        this.themeSecondaryRgb = [244, 63, 94];
        this.themeSparkRgb = [251, 191, 36];

        this.embers = [];
        this.nodes = [];
        this.orbs = [];
        this.shockwaves = [];

        this.mouse = {
            x: -1000,
            y: -1000,
            targetX: -1000,
            targetY: -1000,
            active: false,
            parallaxX: 0,
            parallaxY: 0
        };

        this.lastTime = performance.now();
        this.animFrameId = null;
        this.isActive = true;

        this.readCSSTheme();
        this.init();
    }

    readCSSTheme() {
        const page = document.querySelector('.auth-page');
        if (page) {
            const comp = getComputedStyle(page);
            const rgbStr = comp.getPropertyValue('--auth-accent-rgb').trim();
            if (rgbStr) {
                const parts = rgbStr.split(',').map(n => parseInt(n.trim(), 10));
                if (parts.length === 3 && !parts.some(isNaN)) {
                    this.themeRgb = parts;
                }
            }
        }
    }

    setThemePalette(primaryRgb, secondaryRgb = null, sparkRgb = null) {
        if (primaryRgb && primaryRgb.length === 3) {
            this.themeRgb = primaryRgb;
            this.themeSecondaryRgb = secondaryRgb || [
                Math.min(255, primaryRgb[0] + 30),
                Math.min(255, primaryRgb[1] + 20),
                Math.min(255, primaryRgb[2] + 20)
            ];
            this.themeSparkRgb = sparkRgb || [251, 191, 36];
            this.initParticles();
        }
    }

    init() {
        this.resize();
        this.initParticles();
        this.bindEvents();
        this.start();
    }

    resize() {
        const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : {
            width: window.innerWidth,
            height: window.innerHeight
        };
        this.width = Math.ceil(rect.width || window.innerWidth);
        this.height = Math.ceil(rect.height || window.innerHeight);

        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        this.ctx.scale(this.dpr, this.dpr);
    }

    initParticles() {
        this.embers = [];
        this.nodes = [];
        this.orbs = [];

        const densityFactor = (this.width * this.height) / (1920 * 1080);
        const emberCount = Math.floor(this.options.emberCount * Math.max(0.6, densityFactor));
        const nodeCount = Math.floor(this.options.nodeCount * Math.max(0.6, densityFactor));

        // Create Glowing Flame / Chakra Embers
        for (let i = 0; i < emberCount; i++) {
            this.embers.push(this.createEmber(true));
        }

        // Create Cyber Constellation Nodes
        for (let i = 0; i < nodeCount; i++) {
            this.nodes.push(this.createNode());
        }

        // Create Atmospheric Chakra Nebula Orbs
        for (let i = 0; i < this.options.orbCount; i++) {
            this.orbs.push(this.createOrb(i));
        }
    }

    createEmber(randomY = false) {
        const [r, g, b] = this.themeRgb;
        const [sR, sG, sB] = this.themeSecondaryRgb;
        const [kR, kG, kB] = this.themeSparkRgb;

        const colors = [
            `rgba(${r}, ${g}, ${b}, `,
            `rgba(${sR}, ${sG}, ${sB}, `,
            `rgba(${Math.min(255, r + 40)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)}, `,
            `rgba(${kR}, ${kG}, ${kB}, `,
            'rgba(255, 255, 255, '
        ];
        
        const colorWeights = [0, 0, 1, 1, 2, 3, 4];
        const chosenColor = colors[colorWeights[Math.floor(Math.random() * colorWeights.length)]];

        return {
            x: Math.random() * this.width,
            y: randomY ? Math.random() * this.height : this.height + 15 + Math.random() * 50,
            radius: Math.random() * 2.8 + 0.8,
            baseRadius: Math.random() * 2.8 + 0.8,
            colorPrefix: chosenColor,
            alpha: Math.random() * 0.7 + 0.3,
            maxAlpha: Math.random() * 0.6 + 0.4,
            speedY: -(Math.random() * 1.6 + 0.6),
            speedX: (Math.random() - 0.5) * 0.8,
            swaySpeed: Math.random() * 0.03 + 0.01,
            swayAmplitude: Math.random() * 1.5 + 0.5,
            swayOffset: Math.random() * Math.PI * 2,
            life: Math.random() * 0.5 + 0.5,
            decay: Math.random() * 0.003 + 0.0015,
            glow: Math.random() > 0.4
        };
    }

    createNode() {
        const [r, g, b] = this.themeRgb;
        const [sR, sG, sB] = this.themeSecondaryRgb;

        return {
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            vx: (Math.random() - 0.5) * 0.55,
            vy: (Math.random() - 0.5) * 0.55,
            radius: Math.random() * 1.8 + 1.0,
            alpha: Math.random() * 0.5 + 0.3,
            color: Math.random() > 0.25 ? `rgba(${r}, ${g}, ${b}, ` : `rgba(${sR}, ${sG}, ${sB}, `,
            pulseSpeed: Math.random() * 0.02 + 0.01,
            pulseVal: Math.random() * Math.PI * 2
        };
    }

    createOrb(index) {
        const [r, g, b] = this.themeRgb;
        const [sR, sG, sB] = this.themeSecondaryRgb;

        const themes = [
            { color: `${r}, ${g}, ${b}`, maxAlpha: 0.16, radius: 300 },
            { color: `${sR}, ${sG}, ${sB}`, maxAlpha: 0.12, radius: 340 },
            { color: `${Math.min(255, r + 50)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 10)}`, maxAlpha: 0.10, radius: 260 },
            { color: `251, 191, 36`, maxAlpha: 0.08, radius: 240 }
        ];
        const theme = themes[index % themes.length];
        return {
            x: (this.width / (this.options.orbCount + 1)) * (index + 1) + (Math.random() - 0.5) * 100,
            y: this.height * 0.3 + Math.random() * (this.height * 0.4),
            radius: theme.radius + (Math.random() - 0.5) * 60,
            baseRadius: theme.radius,
            color: theme.color,
            alpha: theme.maxAlpha * 0.5,
            maxAlpha: theme.maxAlpha,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25,
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: 0.008 + Math.random() * 0.008
        };
    }

    triggerShockwave(x, y) {
        const [r, g, b] = this.themeRgb;
        this.shockwaves.push({
            x: x,
            y: y,
            radius: 5,
            maxRadius: Math.min(this.width, this.height) * 0.45,
            speed: 7,
            alpha: 0.8,
            colorRgb: `${r}, ${g}, ${b}`
        });

        // Disperse nearby embers & nodes
        const blastRadius = 260;
        const pushForce = 12;

        const applyForce = (p) => {
            const dx = p.x - x;
            const dy = p.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < blastRadius && dist > 1) {
                const force = (1 - dist / blastRadius) * pushForce;
                p.x += (dx / dist) * force;
                p.y += (dy / dist) * force;
                if (p.speedY !== undefined) p.speedY -= force * 0.2;
            }
        };

        this.embers.forEach(applyForce);
        this.nodes.forEach(applyForce);
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.initParticles();
        });

        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.targetX = e.clientX - rect.left;
            this.mouse.targetY = e.clientY - rect.top;
            this.mouse.active = true;

            // Parallax offset calculation
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            this.mouse.parallaxX = ((e.clientX - cx) / cx) * 15;
            this.mouse.parallaxY = ((e.clientY - cy) / cy) * 15;

            this.updateParallaxDOM();
        });

        window.addEventListener('mouseleave', () => {
            this.mouse.active = false;
            this.mouse.targetX = -1000;
            this.mouse.targetY = -1000;
            this.mouse.parallaxX = 0;
            this.mouse.parallaxY = 0;
            this.updateParallaxDOM();
        });

        // Click / Tap Shockwave anywhere on background stage
        document.addEventListener('click', (e) => {
            if (e.target.closest('input, button, a, label, select, .auth-card')) return;
            const rect = this.canvas.getBoundingClientRect();
            this.triggerShockwave(e.clientX - rect.left, e.clientY - rect.top);
        });

        // Handle page visibility / background tabs
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.isActive = false;
                if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
            } else {
                this.isActive = true;
                this.lastTime = performance.now();
                this.start();
            }
        });
    }

    updateParallaxDOM() {
        if (!this.options.enableParallax) {
            const bgImg = document.querySelector('.auth-bg-image');
            const card = document.querySelector('.auth-card-container');
            if (bgImg && bgImg.style.transform) bgImg.style.transform = '';
            if (card && card.style.transform) card.style.transform = '';
            return;
        }
        const bgImg = document.querySelector('.auth-bg-image');
        const card = document.querySelector('.auth-card-container');

        if (bgImg) {
            bgImg.style.transform = `scale(1.03) translate(${this.mouse.parallaxX * -0.4}px, ${this.mouse.parallaxY * -0.4}px)`;
        }
        if (card && window.innerWidth > 900) {
            card.style.transform = `translate(${this.mouse.parallaxX * 0.3}px, ${this.mouse.parallaxY * 0.3}px)`;
        }
    }

    update(dt) {
        // Smooth mouse follow
        if (this.mouse.active) {
            this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.15;
            this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.15;
        } else {
            this.mouse.x = -1000;
            this.mouse.y = -1000;
        }

        // 1. Update Atmospheric Orbs
        for (let i = 0; i < this.orbs.length; i++) {
            const orb = this.orbs[i];
            orb.x += orb.vx * dt * 60;
            orb.y += orb.vy * dt * 60;
            orb.pulse += orb.pulseSpeed * dt * 60;
            orb.alpha = (Math.sin(orb.pulse) * 0.3 + 0.7) * orb.maxAlpha;
            orb.radius = orb.baseRadius + Math.sin(orb.pulse * 0.5) * 20;

            if (orb.x < -100) orb.vx = Math.abs(orb.vx);
            if (orb.x > this.width + 100) orb.vx = -Math.abs(orb.vx);
            if (orb.y < -100) orb.vy = Math.abs(orb.vy);
            if (orb.y > this.height + 100) orb.vy = -Math.abs(orb.vy);
        }

        // 2. Update Flame Embers
        for (let i = 0; i < this.embers.length; i++) {
            const p = this.embers[i];
            p.swayOffset += p.swaySpeed * dt * 60;
            p.x += (p.speedX + Math.sin(p.swayOffset) * p.swayAmplitude) * dt * 60;
            p.y += p.speedY * dt * 60;
            p.life -= p.decay * dt * 60;
            p.alpha = Math.max(0, p.life * p.maxAlpha);

            // Mouse deflection
            if (this.mouse.active) {
                const dx = p.x - this.mouse.x;
                const dy = p.y - this.mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.options.mouseRadius && dist > 1) {
                    const force = (1 - dist / this.options.mouseRadius) * 2.5;
                    p.x += (dx / dist) * force;
                    p.y += (dy / dist) * force - 0.5;
                }
            }

            // Recycle expired embers
            if (p.life <= 0 || p.y < -30 || p.x < -30 || p.x > this.width + 30) {
                this.embers[i] = this.createEmber(false);
            }
        }

        // 3. Update Constellation Nodes
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            node.x += node.vx * dt * 60;
            node.y += node.vy * dt * 60;
            node.pulseVal += node.pulseSpeed * dt * 60;

            // Mouse interaction - gentle attraction & deflection
            if (this.mouse.active) {
                const dx = this.mouse.x - node.x;
                const dy = this.mouse.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.options.mouseRadius && dist > 1) {
                    const pull = (1 - dist / this.options.mouseRadius) * 0.6;
                    node.x += (dx / dist) * pull;
                    node.y += (dy / dist) * pull;
                }
            }

            // Wrap screen edges smoothly
            if (node.x < -20) node.x = this.width + 20;
            if (node.x > this.width + 20) node.x = -20;
            if (node.y < -20) node.y = this.height + 20;
            if (node.y > this.height + 20) node.y = -20;
        }

        // 4. Update Shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += sw.speed * dt * 60;
            sw.alpha *= Math.pow(0.94, dt * 60);
            if (sw.alpha < 0.01 || sw.radius > sw.maxRadius) {
                this.shockwaves.splice(i, 1);
            }
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Layer 1: Atmospheric Glow Orbs
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < this.orbs.length; i++) {
            const orb = this.orbs[i];
            const grad = this.ctx.createRadialGradient(
                orb.x, orb.y, 0,
                orb.x, orb.y, orb.radius
            );
            grad.addColorStop(0, `rgba(${orb.color}, ${orb.alpha})`);
            grad.addColorStop(0.5, `rgba(${orb.color}, ${orb.alpha * 0.4})`);
            grad.addColorStop(1, `rgba(${orb.color}, 0)`);

            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();

        // Layer 2: Constellation Links & Nodes
        this.ctx.save();
        const maxDist = this.options.maxConnectionDist;
        const nodeLen = this.nodes.length;

        // Connecting lines between nodes
        for (let i = 0; i < nodeLen; i++) {
            const n1 = this.nodes[i];
            for (let j = i + 1; j < nodeLen; j++) {
                const n2 = this.nodes[j];
                const dx = n1.x - n2.x;
                const dy = n1.y - n2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < maxDist) {
                    const lineAlpha = (1 - dist / maxDist) * 0.22;
                    this.ctx.strokeStyle = `rgba(${this.themeRgb.join(', ')}, ${lineAlpha})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(n1.x, n1.y);
                    this.ctx.lineTo(n2.x, n2.y);
                    this.ctx.stroke();
                }
            }

            // Connect to mouse cursor
            if (this.mouse.active) {
                const mdx = n1.x - this.mouse.x;
                const mdy = n1.y - this.mouse.y;
                const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
                if (mdist < this.options.mouseRadius) {
                    const mAlpha = (1 - mdist / this.options.mouseRadius) * 0.5;
                    this.ctx.strokeStyle = `rgba(${this.themeSecondaryRgb.join(', ')}, ${mAlpha})`;
                    this.ctx.lineWidth = 1.2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(n1.x, n1.y);
                    this.ctx.lineTo(this.mouse.x, this.mouse.y);
                    this.ctx.stroke();
                }
            }
        }

        // Draw Node Points
        for (let i = 0; i < nodeLen; i++) {
            const n = this.nodes[i];
            const pulse = Math.sin(n.pulseVal) * 0.3 + 0.7;
            const r = n.radius * (0.8 + pulse * 0.4);

            this.ctx.fillStyle = `${n.color}${n.alpha * pulse})`;
            this.ctx.beginPath();
            this.ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            this.ctx.fill();

            // Bright core
            this.ctx.fillStyle = `rgba(255, 255, 255, ${n.alpha * 0.8})`;
            this.ctx.beginPath();
            this.ctx.arc(n.x, n.y, r * 0.4, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();

        // Layer 3: Rising Flame & Chakra Embers
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';

        for (let i = 0; i < this.embers.length; i++) {
            const p = this.embers[i];
            if (p.alpha <= 0.01) continue;

            const glowRadius = p.radius * (p.glow ? 4.5 : 2.5);
            const glowGrad = this.ctx.createRadialGradient(
                p.x, p.y, 0,
                p.x, p.y, glowRadius
            );
            glowGrad.addColorStop(0, `${p.colorPrefix}${p.alpha})`);
            glowGrad.addColorStop(0.4, `${p.colorPrefix}${p.alpha * 0.4})`);
            glowGrad.addColorStop(1, `${p.colorPrefix}0)`);

            this.ctx.fillStyle = glowGrad;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
            this.ctx.fill();

            // Bright ember core
            this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, p.alpha * 1.2)})`;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();

        // Layer 4: Interactive Shockwaves
        if (this.shockwaves.length > 0) {
            this.ctx.save();
            for (let i = 0; i < this.shockwaves.length; i++) {
                const sw = this.shockwaves[i];
                this.ctx.strokeStyle = `rgba(${sw.colorRgb || this.themeRgb.join(', ')}, ${sw.alpha * 0.7})`;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                this.ctx.stroke();

                // Faint inner glow ring
                this.ctx.strokeStyle = `rgba(${this.themeSecondaryRgb.join(', ')}, ${sw.alpha * 0.35})`;
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.arc(sw.x, sw.y, Math.max(0, sw.radius - 4), 0, Math.PI * 2);
                this.ctx.stroke();
            }
            this.ctx.restore();
        }
    }

    start() {
        const loop = (currentTime) => {
            if (!this.isActive) return;
            const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
            this.lastTime = currentTime;

            this.update(dt);
            this.render();

            this.animFrameId = requestAnimationFrame(loop);
        };
        this.lastTime = performance.now();
        this.animFrameId = requestAnimationFrame(loop);
    }

    destroy() {
        this.isActive = false;
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    }
}

// Global Export
window.AuthBackgroundEngine = AuthBackgroundEngine;
