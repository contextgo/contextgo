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

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight; // Fill viewport or parent
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

    // Initialize particles
    const initParticles = () => {
      particles = [];
      const particleCount = (canvas.width * canvas.height) / 10000; // Slightly more density
      
      for (let i = 0; i < particleCount; i++) {
        const size = Math.random() * 2.5 + 1;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        
        // Colors: Darker and more visible
        const colors = [
          `rgba(0, 0, 0, ${Math.random() * 0.4 + 0.3})`,     // Rich Black
          `rgba(60, 60, 60, ${Math.random() * 0.4 + 0.3})`,   // Dark Gray
          `rgba(120, 120, 120, ${Math.random() * 0.3 + 0.2})` // Mid Gray
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];

        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.8, // Initial velocity
          vy: (Math.random() - 0.5) * 0.8,
          size,
          color,
          baseX: x,
          baseY: y,
          density: (Math.random() * 30) + 1,
        });
      }
    };

    // Animation Loop
    const animate = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // 1. Mouse Interaction (Attraction)
        if (mouse.current.x !== null && mouse.current.y !== null) {
          const dx = mouse.current.x - p.x;
          const dy = mouse.current.y - p.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < mouse.current.radius * 2) {
             const forceDirectionX = dx / distance;
             const forceDirectionY = dy / distance;
             const maxDistance = mouse.current.radius;
             
             // Calculate force: stronger when closer, but linear falloff
             const force = (maxDistance - distance) / maxDistance;
             
             // Attraction force
             p.vx += forceDirectionX * force * 0.8;
             p.vy += forceDirectionY * force * 0.8;

             // CRITICAL: Add "magnetic friction"
             // When near the mouse, slow down the particle's existing chaos
             // so it doesn't overshoot or drift away.
             p.vx *= 0.85; 
             p.vy *= 0.85;
          }
        }

        // 2. Continuous Movement & Physics
        // Add a tiny random force to keep it "unpredictable"
        p.vx += (Math.random() - 0.5) * 0.05;
        p.vy += (Math.random() - 0.5) * 0.05;

        // Apply a much lighter friction to keep them moving
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Velocity cap to prevent runaway speed
        const maxSpeed = 1.2;
        const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (currentSpeed > maxSpeed) {
            p.vx = (p.vx / currentSpeed) * maxSpeed;
            p.vy = (p.vy / currentSpeed) * maxSpeed;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Boundary checks - wrap around for continuous flow
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Draw Particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };

    // Init
    handleResize();
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-auto z-0"
      style={{ background: 'transparent' }}
    />
  );
}
