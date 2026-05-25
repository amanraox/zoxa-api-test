"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type WireframeOrbSettings = {
  color1?: string
  color2?: string
  spikeAmount?: number
  spikeFrequency?: number
  spikeSpeed?: number
  rotationSpeed?: number
  segments?: number
  lineWidth?: number
  pulseSpeed?: number
  pulseAmount?: number
  innerSphere?: boolean
  glowColor?: string
}

const defaultSettings: Required<WireframeOrbSettings> = {
  color1: "#2792dc",
  color2: "#9ce6e6",
  spikeAmount: 0.4,
  spikeFrequency: 3.0,
  spikeSpeed: 0.6,
  rotationSpeed: 0.15,
  segments: 32,
  lineWidth: 1.0,
  pulseSpeed: 1.0,
  pulseAmount: 0.1,
  innerSphere: true,
  glowColor: "#2792dc",
}

function WireframeScene({ settings }: { settings: Required<WireframeOrbSettings> }) {
  const wireRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const innerMatRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(settings.color1) },
    uColor2: { value: new THREE.Color(settings.color2) },
    uSpikeAmount: { value: settings.spikeAmount },
    uSpikeFrequency: { value: settings.spikeFrequency },
    uPulseAmount: { value: settings.pulseAmount },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  const innerUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uGlowColor: { value: new THREE.Color(settings.glowColor) },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (!matRef.current || !wireRef.current) return
    const u = matRef.current.uniforms
    u.uTime.value += delta * settings.spikeSpeed
    u.uColor1.value.set(settings.color1)
    u.uColor2.value.set(settings.color2)
    u.uSpikeAmount.value = settings.spikeAmount
    u.uSpikeFrequency.value = settings.spikeFrequency
    u.uPulseAmount.value = settings.pulseAmount
    wireRef.current.rotation.y += delta * settings.rotationSpeed
    wireRef.current.rotation.x += delta * settings.rotationSpeed * 0.3

    if (innerRef.current && innerMatRef.current) {
      innerMatRef.current.uniforms.uTime.value += delta * settings.pulseSpeed
      innerMatRef.current.uniforms.uGlowColor.value.set(settings.glowColor)
      innerRef.current.rotation.y = wireRef.current.rotation.y
      innerRef.current.rotation.x = wireRef.current.rotation.x
    }
  })

  const vertexShader = `
    uniform float uTime;
    uniform float uSpikeAmount;
    uniform float uSpikeFrequency;
    uniform float uPulseAmount;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vDisplacement;

    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
      vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
      vec3 i1=min(g,l.zxy);vec3 i2=max(g,l.zxy);
      vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
      i=mod(i,289.);
      vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
      float n_=1./7.;vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
      vec4 x2_=x_*ns.x+ns.yyyy;vec4 y2_=y_*ns.x+ns.yyyy;
      vec4 h=1.-abs(x2_)-abs(y2_);vec4 b0=vec4(x2_.xy,y2_.xy);vec4 b1=vec4(x2_.zw,y2_.zw);
      vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;
      vec4 sh=-step(h,vec4(0.));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
      vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
      return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }

    void main() {
      float n = snoise(position * uSpikeFrequency + uTime);
      float pulse = 1.0 + sin(uTime * 3.14159) * uPulseAmount;
      float displacement = n * uSpikeAmount * pulse;
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
    varying float vDisplacement;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      float t = smoothstep(-0.3, 0.4, vDisplacement);
      vec3 color = mix(uColor1, uColor2, t);
      // Edge brightness
      vec3 viewDir = normalize(-vPosition);
      float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 1.5);
      color += color * fresnel * 0.5;
      gl_FragColor = vec4(color, 0.9 + fresnel * 0.1);
    }
  `

  const innerVert = `varying vec3 vNormal; varying vec3 vPosition;
    void main() { vNormal=normalize(normalMatrix*normal); vPosition=(modelViewMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`
  const innerFrag = `uniform float uTime; uniform vec3 uGlowColor; varying vec3 vNormal; varying vec3 vPosition;
    void main() { vec3 v=normalize(-vPosition); float f=pow(1.-abs(dot(vNormal,v)),2.5);
      float pulse=0.6+0.4*sin(uTime*3.14159);
      vec3 c=uGlowColor*f*pulse*1.5;
      gl_FragColor=vec4(c,f*0.6*pulse); }`

  return (
    <>
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1.5, settings.segments]} />
        <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} wireframe transparent />
      </mesh>
      {settings.innerSphere && (
        <mesh ref={innerRef} scale={[0.7, 0.7, 0.7]}>
          <icosahedronGeometry args={[1.5, 16]} />
          <shaderMaterial ref={innerMatRef} uniforms={innerUniforms} vertexShader={innerVert} fragmentShader={innerFrag} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </>
  )
}

export function WireframeOrb({ settings, className }: { settings?: WireframeOrbSettings; className?: string }) {
  const s = { ...defaultSettings, ...settings }
  return (
    <div className={className ?? "relative h-full w-full"}>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <WireframeScene settings={s} />
      </Canvas>
    </div>
  )
}

export { defaultSettings as wireframeOrbDefaults }
