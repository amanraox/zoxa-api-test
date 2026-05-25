"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type CrystalOrbSettings = {
  color1?: string
  color2?: string
  facets?: number
  rotationSpeed?: number
  pulseSpeed?: number
  pulseAmount?: number
  edgeGlow?: number
  innerGlow?: number
  refraction?: number
  detail?: number
}

const defaultSettings: Required<CrystalOrbSettings> = {
  color1: "#2792dc",
  color2: "#9ce6e6",
  facets: 4,
  rotationSpeed: 0.3,
  pulseSpeed: 0.8,
  pulseAmount: 0.1,
  edgeGlow: 1.5,
  innerGlow: 0.5,
  refraction: 0.3,
  detail: 1,
}

function CrystalScene({ settings }: { settings: Required<CrystalOrbSettings> }) {
  const groupRef = useRef<THREE.Group>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(settings.color1) },
    uColor2: { value: new THREE.Color(settings.color2) },
    uPulseAmount: { value: settings.pulseAmount },
    uEdgeGlow: { value: settings.edgeGlow },
    uInnerGlow: { value: settings.innerGlow },
    uRefraction: { value: settings.refraction },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (!matRef.current || !groupRef.current) return
    const u = matRef.current.uniforms
    u.uTime.value += delta * settings.pulseSpeed
    u.uColor1.value.set(settings.color1)
    u.uColor2.value.set(settings.color2)
    u.uPulseAmount.value = settings.pulseAmount
    u.uEdgeGlow.value = settings.edgeGlow
    u.uInnerGlow.value = settings.innerGlow
    u.uRefraction.value = settings.refraction
    groupRef.current.rotation.y += delta * settings.rotationSpeed
    groupRef.current.rotation.x += delta * settings.rotationSpeed * 0.4
  })

  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uPulseAmount;
    uniform float uEdgeGlow;
    uniform float uInnerGlow;
    uniform float uRefraction;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldNormal;

    void main() {
      vec3 viewDir = normalize(-vPosition);

      // Fresnel for edge glow
      float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), uEdgeGlow);

      // Face-based coloring (different facets get different colors)
      float faceMix = dot(vWorldNormal, vec3(0.577, 0.577, 0.577));
      faceMix = faceMix * 0.5 + 0.5;

      // Pulsing
      float pulse = 1.0 + sin(uTime * 3.14159) * uPulseAmount;

      // Fake refraction - shift color based on view angle
      float refract = dot(vNormal, vec3(sin(uTime * 0.5), cos(uTime * 0.3), 0.5)) * uRefraction;

      vec3 baseColor = mix(uColor1, uColor2, clamp(faceMix + refract, 0.0, 1.0));

      // Inner glow
      float inner = (1.0 - fresnel) * uInnerGlow;
      vec3 innerColor = mix(uColor2, uColor1, 0.5) * inner;

      // Edge glow
      vec3 edgeColor = mix(uColor1, uColor2, 0.7) * fresnel * 2.0;

      // Specular highlights on facet edges
      vec3 lightDir = normalize(vec3(1.0, 1.0, 2.0));
      float spec = pow(max(dot(reflect(-lightDir, vNormal), viewDir), 0.0), 64.0);

      // Combine
      vec3 color = baseColor * pulse * 0.6 + innerColor + edgeColor + vec3(1.0) * spec * 0.5;

      // Transparency with fresnel
      float alpha = 0.7 + fresnel * 0.3;

      gl_FragColor = vec4(color, alpha);
    }
  `

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[1.5, settings.detail]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Inner glow mesh */}
      <mesh scale={[0.95, 0.95, 0.95]}>
        <icosahedronGeometry args={[1.5, settings.detail]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  )
}

export function CrystalOrb({ settings, className }: { settings?: CrystalOrbSettings; className?: string }) {
  const s = { ...defaultSettings, ...settings }
  return (
    <div className={className ?? "relative h-full w-full"}>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <CrystalScene settings={s} />
      </Canvas>
    </div>
  )
}

export { defaultSettings as crystalOrbDefaults }
