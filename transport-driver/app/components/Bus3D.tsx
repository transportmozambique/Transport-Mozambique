"use client";

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Bus3DProps {
  rotation?: number; // Rotation in degrees (0-360)
  scale?: number;
}

export default function Bus3D({ rotation = 0, scale = 1 }: Bus3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = 80 * scale;
    const height = 80 * scale;
    
    canvas.width = width;
    canvas.height = height;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = null;

    // Setup camera - view from behind/above to see bus heading forward
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 3, 5); // Behind and above the bus
    camera.lookAt(0, 0.6, 0); // Look at the center of the bus body
    camera.up.set(0, 1, 0); // Ensure camera is upright

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ 
      canvas, 
      alpha: true,
      antialias: true 
    });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Create bus group
    const busGroup = new THREE.Group();

    // Bus body (main) - positioned so wheels touch ground
    // Building along X-axis so front faces X+ direction
    const bodyGeometry = new THREE.BoxGeometry(4, 1.2, 2); // Swapped X and Z
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x2563eb,
      shininess: 30
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6; // Raised so wheels at y=0 touch ground
    body.castShadow = true;
    busGroup.add(body);

    // Bus roof
    const roofGeometry = new THREE.BoxGeometry(3.5, 0.3, 1.8); // Swapped X and Z
    const roofMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x1e40af 
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 1.35;
    roof.castShadow = true;
    busGroup.add(roof);

    // Windows (front)
    const windowGeometry = new THREE.BoxGeometry(0.1, 0.6, 1.9); // Swapped X and Z
    const windowMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.7
    });
    
    const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    frontWindow.position.set(2.05, 0.9, 0); // Front at X+
    busGroup.add(frontWindow);

    // Side windows
    const sideWindowGeometry = new THREE.BoxGeometry(0.8, 0.5, 0.1); // Swapped X and Z
    for (let i = 0; i < 4; i++) {
      const leftWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
      leftWindow.position.set(1.5 - i * 1, 0.9, -1.05); // Left side at Z-
      busGroup.add(leftWindow);

      const rightWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
      rightWindow.position.set(1.5 - i * 1, 0.9, 1.05); // Right side at Z+
      busGroup.add(rightWindow);
    }

    // Wheels - positioned so bottom touches ground (y=0)
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16);
    const wheelMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x1f2937 
    });

    const wheelPositions = [
      [1.5, 0.3, -0.9],  // Front left (X+, Z-)
      [1.5, 0.3, 0.9],   // Front right (X+, Z+)
      [-1.5, 0.3, -0.9], // Back left (X-, Z-)
      [-1.5, 0.3, 0.9],  // Back right (X-, Z+)
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(x, y, z);
      wheel.rotation.x = Math.PI / 2; // Rotate to lie along Z-axis
      wheel.castShadow = true;
      busGroup.add(wheel);

      // Wheel rim
      const rimGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.32, 16);
      const rimMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x4b5563 
      });
      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      rim.position.set(x, y, z);
      rim.rotation.x = Math.PI / 2;
      busGroup.add(rim);
    });

    // Headlights - at front (X+)
    const headlightGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const headlightMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.5
    });

    const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    leftHeadlight.position.set(2.1, 0.4, -0.6); // Front at X+, left at Z-
    busGroup.add(leftHeadlight);

    const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    rightHeadlight.position.set(2.1, 0.4, 0.6); // Front at X+, right at Z+
    busGroup.add(rightHeadlight);

    // Door
    const doorGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.1); // Swapped X and Z
    const doorMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x1e3a8a 
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0.5, 0.5, -1.05); // Left side at Z-
    busGroup.add(door);

    // Apply rotation
    // BUS ORIENTATION:
    // - Front (headlights - 2 yellow lights) now at X = +2.1
    //   Left headlight at (2.1, 0.4, -0.6)
    //   Right headlight at (2.1, 0.4, 0.6)
    // - Back at X = -2
    //
    // GOAL: Route line passes between the two yellow headlights
    // 
    // RENDERING STRATEGY:
    // - Bus built along X-axis (front at X+) to match screen coordinates
    // - MapLibre's setRotation() rotates the entire canvas to match bearing
    // - No additional rotation needed
    busGroup.rotation.y = THREE.MathUtils.degToRad(0);

    scene.add(busGroup);

    // Render
    renderer.render(scene, camera);

    // Cleanup
    return () => {
      renderer.dispose();
      scene.clear();
    };
  }, [rotation, scale]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        width: `${80 * (scale || 1)}px`, 
        height: `${80 * (scale || 1)}px`,
        display: 'block'
      }} 
    />
  );
}
