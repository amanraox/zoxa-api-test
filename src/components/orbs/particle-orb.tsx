"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type ParticleOrbSettings = {
  color1?: string
  color2?: string
  particleCount?: number
  particleSize?: number
  radius?: number
  noiseScale?: number
  noiseSpeed?: number
  noiseAmplitude?: number
  rotationSpeed?: number
  sparkle?: number
}

const defaultSettings: Required<ParticleOrbSettings> = {
  color1: "#2792dc",
  color2: "#9ce6e6",
  particleCount: 3000,
  particleSize: 2.0,
  radius: 1.5,
  noiseScale: 1.5,
  noiseSpeed: 0.3,
  noiseAmplitude: 0.4,
  rotationSpeed: 0.15,
  sparkle: 0.5,
}

function ParticleScene({ settings }: { settings: Required<ParticleOrbSettings> }) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const { positions, randoms } = useMemo(() => {
    const count = settings.particleCount
    const pos = new Float32Array(count * 3)
    const rand = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = settings.radius * (0.8 + Math.random() * 0.4)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
      rand[i] = Math.random()
    }
    return { positions: pos, randoms: rand }
  }, [settings.particleCount, settings.radius])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(settings.color1) },
    uColor2: { value: new THREE.Color(settings.color2) },
    uPointSize: { value: settings.particleSize },
    uNoiseScale: { value: settings.noiseScale },
    uNoiseSpeed: { value: settings.noiseSpeed },
    uNoiseAmp: { value: settings.noiseAmplitude },
    uSparkle: { value: settings.sparkle },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (!materialRef.current || !pointsRef.current) return
    const u = materialRef.current.uniforms
    u.uTime.value += delta
    u.uColor1.value.set(settings.color1)
    u.uColor2.value.set(settings.color2)
    u.uPointSize.value = settings.particleSize
    u.uNoiseScale.value = settings.noiseScale
    u.uNoiseSpeed.value = settings.noiseSpeed
    u.uNoiseAmp.value = settings.noiseAmplitude
    u.uSparkle.value = settings.sparkle
    pointsRef.current.rotation.y += delta * settings.rotationSpeed
    pointsRef.current.rotation.x += delta * settings.rotationSpeed * 0.3
  })

  const vertexShader = `
    attribute float aRandom;
    uniform float uTime;
    uniform float uPointSize;
    uniform float uNoiseScale;
    uniform float uNoiseSpeed;
    uniform float uNoiseAmp;
    uniform float uSparkle;
    varying float vRandom;
    varying vec3 vPos;

    void main() {
      vRandom = aRandom;
      float t = uTime * uNoiseSpeed;
      vec3 pos = position;
      float offset = sin(pos.x * uNoiseScale + t) * cos(pos.y * uNoiseScale + t * 0.7) * sin(pos.z * uNoiseScale + t * 0.3);
      pos += normalize(position) * offset * uNoiseAmp;
      vPos = pos;
      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      float sparkle = 1.0 + sin(uTime * 3.0 + aRandom * 62.83) * uSparkle;
      gl_PointSize = uPointSize * sparkle * (300.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `

  const fragmentShader = `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    varying float vRandom;
    varying vec3 vPos;

    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      if (d > 1.0) discard;
      float alpha = smoothstep(1.0, 0.0, d);
      vec3 color = mix(uColor1, uColor2, vRandom);
      // Slight brightness variation based on position
      color *= 0.8 + 0.4 * (0.5 + 0.5 * sin(vPos.x * 3.0 + vPos.y * 2.0));
      gl_FragColor = vec4(color, alpha * 0.9);
    }
  `

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export function ParticleOrb({
  settings,
  className,
}: {
  settings?: ParticleOrbSettings
  className?: string
}) {
  const s = { ...defaultSettings, ...settings }
  return (
    <div className={className ?? "relative h-full w-full"}>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <ParticleScene settings={s} />
      </Canvas>
    </div>
  )
}

export { defaultSettings as particleOrbDefaults }
