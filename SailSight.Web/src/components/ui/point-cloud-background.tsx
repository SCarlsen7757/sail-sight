"use client";

import { useEffect, useRef } from "react";

export function PointCloudBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use alpha: false to optimize canvas performance since we clear with solid color
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Large grid configuration to easily fill wide screens
    const cols = 85;
    const rows = 70;
    const spacingX = 22;
    const spacingZ = 22;

    // Camera settings
    const cameraDistance = 1100;
    const focalLength = 950;
    const maxDepth = cameraDistance + (rows * spacingZ) / 2;

    // Track state
    let time = 0;

    // Generate points array with static coordinate jitter to break the "perfect grid" alignment
    const points: { x: number; z: number }[] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // Add random jitter to break geometric lines, giving an organic star-field/noisy look
        const jitterX = (Math.random() - 0.5) * spacingX * 0.85;
        const jitterZ = (Math.random() - 0.5) * spacingZ * 0.85;
        const x = (c - cols / 2) * spacingX + jitterX;
        const z = (r - rows / 2) * spacingZ + jitterZ;
        points.push({ x, z });
      }
    }

    // Handles resizing
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Track mouse movement for subtle parallax tilt
    const handleMouseMove = (e: MouseEvent) => {
      const mx = (e.clientX / window.innerWidth) * 2 - 1;
      const my = (e.clientY / window.innerHeight) * 2 - 1;
      mouseRef.current.targetX = mx * 0.15; // Max yaw shift
      mouseRef.current.targetY = my * 0.12; // Max pitch shift
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Main render loop
    const render = () => {
      // Clear with dark-space background matching your visual style
      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, width, height);

      time += 0.01;

      // Smooth mouse interpolation for beautiful parallax
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      // Base yaw rotation + gentle oscillation + mouse shift
      const yaw = 0.02 * Math.sin(time * 0.08) + mouse.x;
      const pitch = 0.55 + mouse.y; // constant base tilt of ~31 degrees

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      const centerX = width / 2;
      const centerY = height / 2;

      // Sort points by depth for proper painter's algorithm rendering (back-to-front)
      const renderedPoints: { projX: number; projY: number; size: number; alpha: number; depth: number }[] = [];

      // Fade out boundary (vignette)
      const maxRadius = ((cols - 6) * spacingX) / 2;

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];

        // 1. Radial Fade-Out (Vignette) to completely hide square edges
        const d = Math.sqrt(pt.x * pt.x + pt.z * pt.z);
        if (d >= maxRadius) continue; // Skip rendering completely outside radius to save CPU

        const radialFade = Math.max(0, 1 - d / maxRadius);
        const radialAlpha = Math.pow(radialFade, 1.8); // Smooth falloff

        // 2. Coordinate warping (fluid distortion) for a noisy wave structure
        const warpX = pt.x + Math.sin(pt.z * 0.015 + time * 1.6) * 20;
        const warpZ = pt.z + Math.cos(pt.x * 0.015 - time * 1.4) * 20;

        // 3. Layered wave equations (low-frequency macro swells)
        const wave1 = Math.sin(warpX * 0.0045 + time * 1.2) * Math.cos(warpZ * 0.005 + time * 0.9) * 50;
        const wave2 = Math.sin((warpX - warpZ) * 0.0025 - time * 0.5) * 25;
        const wave3 = Math.cos((warpX + warpZ) * 0.006 + time * 0.3) * 12;

        // 4. High-frequency noise layers (turbulent micro-ripples and static-like wave jitter)
        const ripple = Math.sin(warpX * 0.03 + time * 3.8) * Math.cos(warpZ * 0.035 - time * 3.2) * 8;
        const temporalNoise = Math.sin(warpX * 0.09 - time * 7.5) * Math.cos(warpZ * 0.1 + time * 6.5) * 3.5;

        // Final wave height
        const y = wave1 + wave2 + wave3 + ripple + temporalNoise;

        // 3D Rotation Math
        // Yaw (around Y axis)
        const rx = pt.x * cosY - pt.z * sinY;
        const rz = pt.x * sinY + pt.z * cosY;

        // Pitch (around X axis)
        const ry = y * cosP - rz * sinP;
        const rzFinal = y * sinP + rz * cosP;

        // Perspective Projection
        const depth = rzFinal + cameraDistance;

        if (depth > 0) {
          const projX = (rx * focalLength) / depth + centerX;
          const projY = (ry * focalLength) / depth + centerY;

          // Add a generous offscreen margin so waves flow seamlessly in and out of the viewport
          if (projX >= -20 && projX <= width + 20 && projY >= -20 && projY <= height + 20) {
            // Sizing based on depth
            const size = Math.max(0.6, 4.2 * (focalLength / depth));

            // Opacity based on depth (fading out in the distance)
            const depthRatio = Math.max(0, Math.min(1, depth / maxDepth));
            const depthAlpha = Math.max(0.01, 1 - depthRatio);

            // Combine depth alpha and radial vignette alpha
            const alpha = depthAlpha * radialAlpha;

            if (alpha > 0.01) {
              renderedPoints.push({ projX, projY, size, alpha, depth });
            }
          }
        }
      }

      // Sort back-to-front (painter's algorithm)
      renderedPoints.sort((a, b) => b.depth - a.depth);

      // Draw points
      for (let i = 0; i < renderedPoints.length; i++) {
        const rp = renderedPoints[i];
        
        // Color transition: deeper points are teal, closer points are glowing bright white/cyan
        const r = Math.round(rp.alpha * 90);       // glowing white center core for closest dots
        const g = Math.round(210 + rp.alpha * 45); // highly luminous green-blue
        const b = 255;                            // max blue intensity
        
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, rp.alpha * 1.35)})`;
        ctx.fillRect(rp.projX - rp.size / 2, rp.projY - rp.size / 2, rp.size, rp.size);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full pointer-events-none select-none"
      style={{ zIndex: 0 }}
    />
  );
}
