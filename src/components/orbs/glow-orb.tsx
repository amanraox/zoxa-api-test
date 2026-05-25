"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type GlowOrbSettings = {
  coreColor?: string
  glowColor?: string
  pulseSpeed?: number
  pulseAmount?: number
  coreSize?: number
  glowSize?: number
  glowFalloff?: number
  layers?: number
  rotationSpeed?: number
  brightness?: number
}

const defaultSettings: Required<GlowOrbSettings> = {
  coreColor: "#2792dc",
  glowColor: "#9ce6e6",
  pulseSpeed: 1.0,
  pulseAmount: 0.15,
  coreSize: 1.0,
  glowSize: 2.5,
  glowFalloff: 2.0,
  layers: 5,
  rotationSpeed: 0.3,
  brightness: 1.2,
}

function GlowScene({ settings }: { settings: Required<GlowOrbSettings> }) {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.ShaderMaterial>(null)
  const layerRefs = useRef<THREE.ShaderMaterial[]>([])

  const coreUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(settings.coreColor) },
    uPulseSpeed: { value: settings.pulseSpeed },
    uPulseAmount: { value: settings.pulseAmount },
    uBrightness: { value: settings.brightness },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (!coreRef.current || !groupRef.current) return
    coreRef.current.uniforms.uTime.value += delta
    coreRef.current.uniforms.uColor.value.set(settings.coreColor)
    coreRef.current.uniforms.uPulseSpeed.value = settings.pulseSpeed
    coreRef.current.uniforms.uPulseAmount.value = settings.pulseAmount
    coreRef.current.uniforms.uBrightness.value = settings.brightness
    groupRef.current.rotation.z += delta * settings.rotationSpeed

    layerRefs.current.forEach((mat) => {
      if (mat) {
        mat.uniforms.uTime.value += delta
        mat.uniforms.uColor.value.set(settings.glowColor)
        mat.uniforms.uPulseSpeed.value = settings.pulseSpeed
        mat.uniforms.uPulseAmount.value = settings.pulseAmount
      }
    })
  })

  const coreVert = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

  const coreFrag = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uPulseSpeed;
    uniform float uPulseAmount;
    uniform float uBrightness;
    varying vec2 vUv;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float pulse = 1.0 + sin(uTime * uPulseSpeed * 3.14159) * uPulseAmount;
      float core = smoothstep(1.0, 0.0, d) * pulse;
      vec3 c = uColor * uBrightness * core;
      float alpha = smoothstep(1.0, 0.3, d);
      gl_FragColor = vec4(c, alpha);
    }
  `

  const glowFrag = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uPulseSpeed;
    uniform float uPulseAmount;
    uniform float uFalloff;
    uniform float uLayerAlpha;
    varying vec2 vUv;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float pulse = 1.0 + sin(uTime * uPulseSpeed * 3.14159 + uLayerAlpha * 6.28) * uPulseAmount;
      float glow = pow(max(0.0, 1.0 - d), uFalloff) * pulse * uLayerAlpha;
      gl_FragColor = vec4(uColor * glow, glow * 0.6);
    }
  `

  return (
    <group ref={groupRef}>
      <mesh>
        <planeGeometry args={[settings.coreSize * 3, settings.coreSize * 3]} />
        <shaderMaterial
          ref={coreRef}
          uniforms={coreUniforms}
          vertexShader={coreVert}
          fragmentShader={coreFrag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {Array.from({ length: settings.layers }).map((_, i) => {
        const scale = 1 + (i + 1) * (settings.glowSize / settings.layers)
        const alpha = 1 - (i + 1) / (settings.layers + 1)
        return (
          <mesh key={i} scale={[scale, scale, 1]}>
            <planeGeometry args={[settings.coreSize * 3, settings.coreSize * 3]} />
            <shaderMaterial
              ref={(el) => { if (el) layerRefs.current[i] = el }}
              uniforms={{
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(settings.glowColor) },
                uPulseSpeed: { value: settings.pulseSpeed },
                uPulseAmount: { value: settings.pulseAmount },
                uFalloff: { value: settings.glowFalloff },
                uLayerAlpha: { value: alpha },
              }}
              vertexShader={coreVert}
              fragmentShader={glowFrag}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export function GlowOrb({
  settings,
  className,
}: {
  settings?: GlowOrbSettings
  className?: string
}) {
  const s = { ...defaultSettings, ...settings }
  return (
    <div className={className ?? "relative h-full w-full"}>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <GlowScene settings={s} />
      </Canvas>
    </div>
  )
}

export { defaultSettings as glowOrbDefaults }
