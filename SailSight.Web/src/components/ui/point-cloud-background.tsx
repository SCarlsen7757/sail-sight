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

    const spacingX = 25;
    const spacingZ = 25;

    // State variables for adaptive grid and camera, updated on mount/resize
    let points: { x: number; z: number }[] = [];
    let cols = 0;
    let rows = 0;
    let maxDepth = 0;
    let maxRadius = 0;
    let cameraDistance = 1000;
    let focalLength = 1050;

    // Dynamic grid calculations: scale grid density and camera projection based on screen size
    const generateGrid = (w: number, h: number) => {
      // Scale columns/rows cleanly. Mobile gets fewer points (high performance), 4K/wide gets extreme detail
      cols = Math.max(45, Math.min(115, Math.floor(w / 18)));
      rows = Math.max(40, Math.min(90, Math.floor(h / 11)));

      // Shift camera parameters for beautiful portrait/landscape crop aspect ratios
      const aspect = w / h;
      if (aspect < 1) {
        // Mobile / Portrait zoom
        cameraDistance = 850;
        focalLength = 1150;
      } else {
        // Desktop / Landscape
        cameraDistance = 1000;
        focalLength = 1050;
      }

      maxDepth = cameraDistance + (rows * spacingZ) / 2;
      maxRadius = (cols * spacingX) / 2;

      points = [];
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const jitterX = (Math.random() - 0.5) * spacingX * 0.85;
          const jitterZ = (Math.random() - 0.5) * spacingZ * 0.85;
          const x = (c - cols / 2) * spacingX + jitterX;
          const z = (r - rows / 2) * spacingZ + jitterZ;
          points.push({ x, z });
        }
      }
    };

    // Initialize grid
    generateGrid(width, height);

    // Track state
    let time = 0;

    // Handles resizing and adaptive grid recomputation
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      generateGrid(width, height);
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

    // Track physical device orientation (gyroscopic/tilt parallax) on mobile
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      
      // Normalize beta (tilt front/back, standard hold is around 60 deg)
      const betaNorm = (e.beta - 60) / 25;
      // Normalize gamma (tilt left/right)
      const gammaNorm = e.gamma / 25;

      const clampedBeta = Math.max(-1, Math.min(1, betaNorm));
      const clampedGamma = Math.max(-1, Math.min(1, gammaNorm));

      // Slightly larger maximum shifts for gorgeous tactile physical feedback
      mouseRef.current.targetX = clampedGamma * 0.18;
      mouseRef.current.targetY = clampedBeta * 0.14;
    };
    window.addEventListener("deviceorientation", handleDeviceOrientation);

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

      // Fade out boundary (vignette) - using full bounds of expanded grid
      const maxRadius = (cols * spacingX) / 2;

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];

        // 1. Radial Fade-Out (Vignette) to completely hide square edges
        const d = Math.sqrt(pt.x * pt.x + pt.z * pt.z);
        if (d >= maxRadius) continue; // Skip rendering completely outside radius to save CPU

        const radialFade = Math.max(0, 1 - d / maxRadius);
        // Exponent 0.65 keeps the dots highly populated and bright near screen edges, while preventing boxy lines
        const radialAlpha = Math.pow(radialFade, 0.65); 

        // 2. Coordinate warping (fluid distortion) for a noisy wave structure
        const warpX = pt.x + Math.sin(pt.z * 0.015 + time * 1.6) * 22;
        const warpZ = pt.z + Math.cos(pt.x * 0.015 - time * 1.4) * 22;

        // 3. Multi-octave wave equations (7 layers of sines/cosines for extreme organic waviness)
        // Octave 1: Large ocean swells
        const swell1 = Math.sin(warpX * 0.0035 + time * 1.1) * Math.cos(warpZ * 0.004 + time * 0.9) * 55;
        const swell2 = Math.cos((warpX - warpZ) * 0.002 - time * 0.5) * 30;

        // Octave 2: Mid-frequency choppy waves
        const chop1 = Math.sin(warpX * 0.009 + time * 1.6) * Math.sin(warpZ * 0.011 - time * 1.3) * 16;
        const chop2 = Math.cos((warpX + warpZ) * 0.0075 + time * 1.0) * 12;

        // Octave 3: High-frequency ripples
        const ripple1 = Math.sin(warpX * 0.022 + time * 2.6) * Math.cos(warpZ * 0.028 - time * 2.2) * 7;
        const ripple2 = Math.sin((warpX - warpZ) * 0.04 - time * 3.6) * 4.5;

        // Octave 4: Fine noise jitter
        const noise = Math.cos(warpX * 0.075 + time * 5.2) * Math.sin(warpZ * 0.085 - time * 4.4) * 3;

        // Final wave height combining all 7 octaves
        const y = swell1 + swell2 + chop1 + chop2 + ripple1 + ripple2 + noise;

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
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
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
