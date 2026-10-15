"use client";

import { createRoot } from 'react-dom/client';
import Bus3D from './Bus3D';

interface Bus3DMarkerProps {
  rotation?: number;
  label: string;
}

export function createBus3DMarkerElement(props: Bus3DMarkerProps) {
  const container = document.createElement('div');
  container.className = 'bus-3d-marker-container';
  
  const markerDiv = document.createElement('div');
  markerDiv.className = 'bus-3d-marker';
  
  const busContainer = document.createElement('div');
  busContainer.className = 'bus-3d-canvas';
  
  const labelDiv = document.createElement('div');
  labelDiv.className = 'bus-3d-label';
  labelDiv.textContent = props.label;
  
  markerDiv.appendChild(busContainer);
  markerDiv.appendChild(labelDiv);
  container.appendChild(markerDiv);
  
  // Render React component into the canvas container
  const root = createRoot(busContainer);
  root.render(<Bus3D rotation={props.rotation || 0} scale={1} />);
  
  return container;
}
