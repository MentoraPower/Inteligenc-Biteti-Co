import { useEffect, useRef } from "react";
import * as THREE from "three";

interface DotShaderBackgroundProps {
  bgColor?: string;
  dotColor?: string;
  gridSize?: number;
  dotOpacity?: number;
}

const DotShaderBackground = ({ 
  bgColor = "#000000", 
  dotColor = "#666666", 
  gridSize = 2000, 
  dotOpacity = 0.6 
}: DotShaderBackgroundProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Create dot grid
    const geometry = new THREE.BufferGeometry();
    const count = gridSize;
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      size: 0.02,
      color: new THREE.Color(dotColor),
      transparent: true,
      opacity: dotOpacity,
    });
    
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    
    camera.position.z = 5;

    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      requestAnimationFrame(animate);
      
      points.rotation.x += 0.0005;
      points.rotation.y += 0.0005;
      
      points.rotation.x += mouseY * 0.0005;
      points.rotation.y += mouseX * 0.0005;
      
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      containerRef.current?.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [bgColor, dotColor, gridSize, dotOpacity]);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 -z-10"
      style={{ backgroundColor: bgColor }}
    />
  );
};

export default DotShaderBackground;
