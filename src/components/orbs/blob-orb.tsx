"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type BlobOrbSettings = {
  color1?: string
  color2?: string
  color3?: string
  speed?: number
  distortion?: number
  frequency?: number
  surfaceDistort?: number
  roughness?: number
  metalness?: number
  envIntensity?: number
  iridescence?: number
}

const defaultSettings: Required<BlobOrbSettings> = {
  color1: "#2792dc",
  color2: "#9ce6e6",
  color3: "#1a5276",
  speed: 0.4,
  distortion: 0.5,
  frequency: 1.5,
  surfaceDistort: 0.8,
  roughness: 0.15,
  metalness: 0.9,
  envIntensity: 1.0,
  iridescence: 0.3,
}

function BlobScene({ settings }: { settings: Required<BlobOrbSettings> }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(settings.color1) },
    uColor2: { value: new THREE.Color(settings.color2) },
    uColor3: { value: new THREE.Color(settings.color3) },
    uDistortion: { value: settings.distortion },
    uFrequency: { value: settings.frequency },
    uSurfaceDistort: { value: settings.surfaceDistort },
    uRoughness: { value: settings.roughness },
    uMetalness: { value: settings.metalness },
    uIridescence: { value: settings.iridescence },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (!matRef.current) return
    const u = matRef.current.uniforms
    u.uTime.value += delta * settings.speed
    u.uColor1.value.set(settings.color1)
    u.uColor2.value.set(settings.color2)
    u.uColor3.value.set(settings.color3)
    u.uDistortion.value = settings.distortion
    u.uFrequency.value = settings.frequency
    u.uSurfaceDistort.value = settings.surfaceDistort
    u.uRoughness.value = settings.roughness
    u.uMetalness.value = settings.metalness
    u.uIridescence.value = settings.iridescence
  })

  const vertexShader = `
    uniform float uTime;
    uniform float uDistortion;
    uniform float uFrequency;
    uniform float uSurfaceDistort;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vDisplacement;
    varying vec2 vUv;

    // Simplex 3D noise
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0);
      const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy));
      vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz);
      vec3 l=1.0-g;
      vec3 i1=min(g.xyz,l.zxy);
      vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx;
      vec3 x2=x0-i2+C.yyy;
      vec3 x3=x0-D.yyy;
      i=mod(i,289.0);
      vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
      float n_=1.0/7.0;
      vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z);
      vec4 x_=floor(j*ns.z);
      vec4 y_=floor(j-7.0*x_);
      vec4 x2_=x_*ns.x+ns.yyyy;
      vec4 y2_=y_*ns.x+ns.yyyy;
      vec4 h=1.0-abs(x2_)-abs(y2_);
      vec4 b0=vec4(x2_.xy,y2_.xy);
      vec4 b1=vec4(x2_.zw,y2_.zw);
      vec4 s0=floor(b0)*2.0+1.0;
      vec4 s1=floor(b1)*2.0+1.0;
      vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
      vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x);
      vec3 p1=vec3(a0.zw,h.y);
      vec3 p2=vec3(a1.xy,h.z);
      vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
      m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }

    void main() {
      vUv = uv;
      float t = uTime;
      // Multi-octave noise for organic blob shape
      float n1 = snoise(position * uFrequency + t) * uDistortion;
      float n2 = snoise(position * uFrequency * 2.0 + t * 1.5) * uDistortion * 0.5;
      float n3 = snoise(position * uFrequency * 4.0 + t * 0.7) * uDistortion * 0.25;
      float displacement = n1 + n2 + n3;

      // Surface micro-detail
      float surface = snoise(position * uFrequency * 8.0 + t * 0.3) * uSurfaceDistort * 0.05;
      displacement += surface;

      vDisplacement = displacement;
      vec3 newPos = position + normal * displacement;
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(newPos, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
  `

  const fragmentShader = `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform float uRoughness;
    uniform float uMetalness;
    uniform float uIridescence;
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vDisplacement;
    varying vec2 vUv;

    void main() {
      // Base color from displacement
      float t = smoothstep(-0.5, 0.5, vDisplacement);
      vec3 baseColor = mix(uColor1, uColor2, t);
      baseColor = mix(baseColor, uColor3, smoothstep(0.3, 0.8, t) * 0.5);

      // Lighting
      vec3 lightDir1 = normalize(vec3(2.0, 3.0, 4.0));
      vec3 lightDir2 = normalize(vec3(-2.0, -1.0, 2.0));
      vec3 viewDir = normalize(-vPosition);

      float diff1 = max(dot(vNormal, lightDir1), 0.0);
      float diff2 = max(dot(vNormal, lightDir2), 0.0) * 0.3;

      // Specular (Blinn-Phong)
      vec3 halfDir1 = normalize(lightDir1 + viewDir);
      float spec1 = pow(max(dot(vNormal, halfDir1), 0.0), mix(8.0, 64.0, 1.0 - uRoughness));

      vec3 halfDir2 = normalize(lightDir2 + viewDir);
      float spec2 = pow(max(dot(vNormal, halfDir2), 0.0), 32.0) * 0.3;

      // Fresnel
      float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);

      // Iridescence effect
      float iri = sin(vDisplacement * 20.0 + uTime * 2.0) * 0.5 + 0.5;
      vec3 iriColor = mix(uColor1, uColor2, iri);

      // Combine
      float metallic = uMetalness;
      vec3 ambient = baseColor * 0.15;
      vec3 diffuse = baseColor * (diff1 + diff2);
      vec3 specular = mix(vec3(0.04), baseColor, metallic) * (spec1 + spec2);
      vec3 fresnelColor = mix(vec3(0.04), mix(baseColor, iriColor, uIridescence), metallic) * fresnel;

      vec3 color = ambient + diffuse * (1.0 - metallic * 0.5) + specular + fresnelColor;

      gl_FragColor = vec4(color, 1.0);
    }
  `

  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.5, 128, 128]} />
        <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
      </mesh>
    </>
  )
}

export function BlobOrb({ settings, className }: { settings?: BlobOrbSettings; className?: string }) {
  const s = { ...defaultSettings, ...settings }
  return (
    <div className={className ?? "relative h-full w-full"}>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <BlobScene settings={s} />
      </Canvas>
    </div>
  )
}

export { defaultSettings as blobOrbDefaults }
