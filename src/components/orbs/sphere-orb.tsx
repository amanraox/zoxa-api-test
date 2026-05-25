"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type SphereOrbSettings = {
  color1?: string
  color2?: string
  noiseFrequency?: number
  noiseAmplitude?: number
  noiseSpeed?: number
  rotationSpeedX?: number
  rotationSpeedY?: number
  segments?: number
  metalness?: number
  roughness?: number
  glowIntensity?: number
  wireframe?: boolean
}

const defaultSettings: Required<SphereOrbSettings> = {
  color1: "#2792dc",
  color2: "#9ce6e6",
  noiseFrequency: 2.0,
  noiseAmplitude: 0.3,
  noiseSpeed: 0.8,
  rotationSpeedX: 0.2,
  rotationSpeedY: 0.3,
  segments: 128,
  metalness: 0.3,
  roughness: 0.4,
  glowIntensity: 0.5,
  wireframe: false,
}

function SphereScene({ settings }: { settings: Required<SphereOrbSettings> }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(settings.color1) },
      uColor2: { value: new THREE.Color(settings.color2) },
      uNoiseFreq: { value: settings.noiseFrequency },
      uNoiseAmp: { value: settings.noiseAmplitude },
      uNoiseSpeed: { value: settings.noiseSpeed },
      uGlowIntensity: { value: settings.glowIntensity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  useFrame((_, delta) => {
    if (!materialRef.current || !meshRef.current) return
    const u = materialRef.current.uniforms
    u.uTime.value += delta
    u.uColor1.value.set(settings.color1)
    u.uColor2.value.set(settings.color2)
    u.uNoiseFreq.value = settings.noiseFrequency
    u.uNoiseAmp.value = settings.noiseAmplitude
    u.uNoiseSpeed.value = settings.noiseSpeed
    u.uGlowIntensity.value = settings.glowIntensity
    meshRef.current.rotation.x += delta * settings.rotationSpeedX
    meshRef.current.rotation.y += delta * settings.rotationSpeedY
  })

  const vertexShader = `
    uniform float uTime;
    uniform float uNoiseFreq;
    uniform float uNoiseAmp;
    uniform float uNoiseSpeed;
    varying vec2 vUv;
    varying float vDisplacement;
    varying vec3 vNormal;
    varying vec3 vPosition;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x2_ = x_ * ns.x + ns.yyyy;
      vec4 y2_ = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x2_) - abs(y2_);
      vec4 b0 = vec4(x2_.xy, y2_.xy);
      vec4 b1 = vec4(x2_.zw, y2_.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m = max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }

    void main() {
      vUv = uv;
      float t = uTime * uNoiseSpeed;
      float n1 = snoise(position * uNoiseFreq + t);
      float n2 = snoise(position * uNoiseFreq * 2.0 + t * 0.5) * 0.5;
      float displacement = (n1 + n2) * uNoiseAmp;
      vDisplacement = displacement;
      vec3 newPosition = position + normal * displacement;
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(newPosition, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `

  const fragmentShader = `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uGlowIntensity;
    varying vec2 vUv;
    varying float vDisplacement;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      float mixFactor = smoothstep(-0.3, 0.3, vDisplacement) * 0.6 + vUv.y * 0.4;
      vec3 color = mix(uColor1, uColor2, clamp(mixFactor, 0.0, 1.0));

      // Simple lighting
      vec3 lightDir = normalize(vec3(1.0, 1.0, 2.0));
      float diff = max(dot(vNormal, lightDir), 0.0);
      float ambient = 0.3;
      float spec = pow(max(dot(reflect(-lightDir, vNormal), normalize(-vPosition)), 0.0), 32.0);

      color = color * (ambient + diff * 0.7) + vec3(1.0) * spec * 0.4;

      // Fresnel glow
      float fresnel = pow(1.0 - abs(dot(vNormal, normalize(-vPosition))), 3.0);
      color += mix(uColor1, uColor2, 0.5) * fresnel * uGlowIntensity;

      gl_FragColor = vec4(color, 1.0);
    }
  `

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.5, settings.segments, settings.segments]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        wireframe={settings.wireframe}
      />
    </mesh>
  )
}

export function SphereOrb({
  settings,
  className,
}: {
  settings?: SphereOrbSettings
  className?: string
}) {
  const s = { ...defaultSettings, ...settings }
  return (
    <div className={className ?? "relative h-full w-full"}>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <SphereScene settings={s} />
      </Canvas>
    </div>
  )
}

export { defaultSettings as sphereOrbDefaults }
