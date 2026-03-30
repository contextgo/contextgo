'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  baseX: number;
  baseY: number;
  density: number;
}

export default function ContextParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef<{ x: number | null; y: number | null; radius: number }>({
    x: null,
    y: null,
    radius: 150,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    const getParticlePalette = () => {
      const styles = window.getComputedStyle(document.documentElement);

      return [
        styles.getPropertyValue('--particle-strong').trim() || 'rgba(15, 23, 42, 0.4)',
        styles.getPropertyValue('--particle-medium').trim() || 'rgba(51, 65, 85, 0.24)',
        styles.getPropertyValue('--particle-soft').trim() || 'rgba(148, 163, 184, 0.16)',
      ];
    };

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initParticles();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current.x = e.clientX - rect.left;
      mouse.current.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.current.x = null;
      mouse.current.y = null;
    };

    const initParticles = () => {
      particles = [];
      const particleCount = (canvas.width * canvas.height) / 10000;
      const colors = getParticlePalette();

      for (let i = 0; i < particleCount; i++) {
        const size = Math.random() * 2.5 + 1;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const color = colors[Math.floor(Math.random() * colors.length)];

        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          size,
          color,
          baseX: x,
          baseY: y,
          density: Math.random() * 30 + 1,
        });
      }
    };

    const animate = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (mouse.current.x !== null && mouse.current.y !== null) {
          const dx = mouse.current.x - p.x;
          const dy = mouse.current.y - p.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 0 && distance < mouse.current.radius * 2) {
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            const maxDistance = mouse.current.radius;
            const force = (maxDistance - distance) / maxDistance;

            p.vx += forceDirectionX * force * 0.8;
            p.vy += forceDirectionY * force * 0.8;
            p.vx *= 0.85;
            p.vy *= 0.85;
          }
        }

        p.vx += (Math.random() - 0.5) * 0.05;
        p.vy += (Math.random() - 0.5) * 0.05;
        p.vx *= 0.98;
        p.vy *= 0.98;

        const maxSpeed = 1.2;
        const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (currentSpeed > maxSpeed) {
          p.vx = (p.vx / currentSpeed) * maxSpeed;
          p.vy = (p.vy / currentSpeed) * maxSpeed;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const themeObserver = new MutationObserver((mutations) => {
      const changedTheme = mutations.some(
        (mutation) =>
          mutation.type === 'attributes' &&
          (mutation.attributeName === 'data-theme' || mutation.attributeName === 'data-theme-mode'),
      );

      if (changedTheme) {
        initParticles();
      }
    });

    handleResize();
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-mode'],
    });

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      themeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className='pointer-events-auto absolute inset-0 z-0'
      style={{ background: 'transparent' }}
    />
  );
}
