"use client";

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface SketchfabBus3DProps {
  rotation?: number;
  scale?: number;
}

export default function SketchfabBus3D({ rotation = 0, scale = 1 }: SketchfabBus3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = 60 * scale;
    const height = 60 * scale;
    
    canvas.width = width;
    canvas.height = height;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = null;

    // Setup camera - top-down view
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 8, 0); // Looking down from above
    camera.lookAt(0, 0, 0);

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ 
      canvas, 
      alpha: true,
      antialias: true 
    });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Load Sketchfab model
    const loader = new GLTFLoader();
    
    // Note: Sketchfab models require authentication to download
    // For now, we'll use a fallback simple bus model
    // To use the actual Sketchfab model, you need to:
    // 1. Download it from Sketchfab (requires account)
    // 2. Place the .glb file in public/models/
    // 3. Update the path below
    
    // Fallback: Create a simple low-poly bus
    const busGroup = new THREE.Group();
    
    // Bus body
    const bodyGeometry = new THREE.BoxGeometry(1.5, 0.8, 3);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x2563eb,
      flatShading: true // Low-poly look
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.4;
    busGroup.add(body);

    // Roof
    const roofGeometry = new THREE.BoxGeometry(1.4, 0.2, 2.8);
    const roofMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x1e40af,
      flatShading: true
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 0.9;
    busGroup.add(roof);

    // Front windshield
    const windshieldGeometry = new THREE.BoxGeometry(1.4, 0.4, 0.1);
    const windshieldMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.6,
      flatShading: true
    });
    const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
    windshield.position.set(0, 0.6, 1.5);
    busGroup.add(windshield);

    // Headlights (yellow)
    const headlightGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const headlightMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.8,
      flatShading: true
    });

    const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    leftHeadlight.position.set(-0.5, 0.3, 1.55);
    busGroup.add(leftHeadlight);

    const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    rightHeadlight.position.set(0.5, 0.3, 1.55);
    busGroup.add(rightHeadlight);

    // Wheels (low-poly)
    const wheelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.2, 8);
    const wheelMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x1f2937,
      flatShading: true
    });

    const wheelPositions = [
      [-0.7, 0.2, 1],
      [0.7, 0.2, 1],
      [-0.7, 0.2, -1],
      [0.7, 0.2, -1],
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(x, y, z);
      wheel.rotation.z = Math.PI / 2;
      busGroup.add(wheel);
    });

    // Apply rotation - bus faces forward (Z+)
    busGroup.rotation.y = THREE.MathUtils.degToRad(rotation);

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
        width: `${60 * (scale || 1)}px`, 
        height: `${60 * (scale || 1)}px`,
        display: 'block'
      }} 
    />
  );
}
