"use client";

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Bus3DProps {
  rotation?: number; // rotação em graus (0-360)
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

    // Câmara atrás e acima do autocarro, para o ver virado para a frente
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 3, 5); // atrás e acima do autocarro
    camera.lookAt(0, 0.6, 0); // a olhar para o centro da carroçaria
    camera.up.set(0, 1, 0); // câmara direita

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

    // Grupo do autocarro
    const busGroup = new THREE.Group();

    // Carroçaria, posicionada para as rodas tocarem no chão
    // Construída ao longo do eixo Z, com a frente virada para Z+
    const bodyGeometry = new THREE.BoxGeometry(2, 1.2, 4);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x2563eb,
      shininess: 30
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6; // levantada para as rodas em y=0 tocarem no chão
    body.castShadow = true;
    busGroup.add(body);

    // Bus roof
    const roofGeometry = new THREE.BoxGeometry(1.8, 0.3, 3.5);
    const roofMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x1e40af 
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 1.35;
    roof.castShadow = true;
    busGroup.add(roof);

    // Windows (front)
    const windowGeometry = new THREE.BoxGeometry(1.9, 0.6, 0.1);
    const windowMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.7
    });
    
    const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    frontWindow.position.set(0, 0.9, 2.05);
    busGroup.add(frontWindow);

    // Side windows
    const sideWindowGeometry = new THREE.BoxGeometry(0.1, 0.5, 0.8);
    for (let i = 0; i < 4; i++) {
      const leftWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
      leftWindow.position.set(-1.05, 0.9, 1.5 - i * 1);
      busGroup.add(leftWindow);

      const rightWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
      rightWindow.position.set(1.05, 0.9, 1.5 - i * 1);
      busGroup.add(rightWindow);
    }

    // Rodas, com a base a tocar no chão (y=0)
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16);
    const wheelMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x1f2937 
    });

    const wheelPositions = [
      [-0.9, 0.3, 1.5],  // Front left
      [0.9, 0.3, 1.5],   // Front right
      [-0.9, 0.3, -1.5], // Back left
      [0.9, 0.3, -1.5],  // Back right
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(x, y, z);
      wheel.rotation.z = Math.PI / 2; // deitada na horizontal
      wheel.castShadow = true;
      busGroup.add(wheel);

      // Wheel rim
      const rimGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.32, 16);
      const rimMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x4b5563 
      });
      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      rim.position.set(x, y, z);
      rim.rotation.z = Math.PI / 2;
      busGroup.add(rim);
    });

    // Faróis (amarelos), à frente
    const headlightGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const headlightMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.5
    });

    const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    leftHeadlight.position.set(-0.6, 0.4, 2.1);
    busGroup.add(leftHeadlight);

    const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    rightHeadlight.position.set(0.6, 0.4, 2.1);
    busGroup.add(rightHeadlight);

    // Door
    const doorGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.6);
    const doorMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x1e3a8a 
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(-1.05, 0.5, 0.5);
    busGroup.add(door);

    // Sem rotação aqui: o autocarro já está virado para Z+ (a frente)
    // O setRotation do MapLibre trata do rumo
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
        width: `${80 * (scale || 1)}px`, 
        height: `${80 * (scale || 1)}px`,
        display: 'block'
      }} 
    />
  );
}
