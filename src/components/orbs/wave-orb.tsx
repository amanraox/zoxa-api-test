"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type WaveOrbSettings = {
  color1?: string
  color2?: string
  color3?: string
  waveSpeed?: number
  waveFrequency?: number
  waveAmplitude?: number
  layers?: number
  rotationSpeed?: number
  spacing?: number
  thickness?: number
  opacity?: number
}

const defaultSettings: Required<WaveOrbSettings> = {
  color1: "#2792dc",
  color2: "#9ce6e6",
  color3: "#1e3a5f",
  waveSpeed: 1.0,
  waveFrequency: 3.0,
  waveAmplitude: 0.3,
  layers: 8,
  rotationSpeed: 0.2,
  spacing: 0.15,
  thickness: 0.02,
  opacity: 0.7,
}

function WaveRing({ index, total, settings, timeRef }: { index: number; total: number; settings: Required<WaveOrbSettings>; timeRef: React.RefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const offset = (index / total) * Math.PI * 2
  const baseRadius = 0.8 + index * settings.spacing

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(settings.color1) },
    uColor2: { value: new THREE.Color(settings.color2) },
    uColor3: { value: new THREE.Color(settings.color3) },
    uIndex: { value: index / total },
    uOpacity: { value: settings.opacity },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return
    const t = timeRef.current ?? 0
    matRef.current.uniforms.uTime.value = t
    matRef.current.uniforms.uColor1.value.set(settings.color1)
    matRef.current.uniforms.uColor2.value.set(settings.color2)
    matRef.current.uniforms.uColor3.value.set(settings.color3)
    matRef.current.uniforms.uOpacity.value = settings.opacity

    // Wave motion
    const wave = Math.sin(t * settings.waveSpeed + offset) * settings.waveAmplitude
    meshRef.current.rotation.x = Math.PI / 2 + wave + index * 0.15
    meshRef.current.rotation.z = Math.sin(t * 0.3 + offset) * 0.3
  })

  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[baseRadius, settings.thickness, 16, 64]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform vec3 uColor3;
          uniform float uIndex;
          uniform float uOpacity;
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vec3 viewDir = normalize(-vPosition);
            float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.0);
            vec3 color = mix(uColor1, uColor2, uIndex);
            color = mix(color, uColor3, fresnel);
            float glow = fresnel * 2.0 + 0.5;
            gl_FragColor = vec4(color * glow, uOpacity + fresnel * 0.3);
          }
        `}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function WaveScene({ settings }: { settings: Required<WaveOrbSettings> }) {
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    timeRef.current += delta
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * settings.rotationSpeed
    }
  })

  return (
    <group ref={groupRef}>
      {Array.from({ length: settings.layers }).map((_, i) => (
        <WaveRing key={i} index={i} total={settings.layers} settings={settings} timeRef={timeRef} />
      ))}
    </group>
  )
}

export function WaveOrb({ settings, className }: { settings?: WaveOrbSettings; className?: string }) {
  const s = { ...defaultSettings, ...settings }
  return (
    <div className={className ?? "relative h-full w-full"}>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <WaveScene settings={s} />
      </Canvas>
    </div>
  )
}

export { defaultSettings as waveOrbDefaults }
