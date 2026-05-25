"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

export type BubbleOrbSettings = {
  baseColor?: string
  filmThickness?: number
  filmSpeed?: number
  deformSpeed?: number
  deformAmount?: number
  deformFreq?: number
  fresnelPower?: number
  rainbowIntensity?: number
  transparency?: number
  shininess?: number
}

const defaultSettings: Required<BubbleOrbSettings> = {
  baseColor: "#c8e6ff",
  filmThickness: 0.5,
  filmSpeed: 0.3,
  deformSpeed: 0.5,
  deformAmount: 0.08,
  deformFreq: 2.0,
  fresnelPower: 3.0,
  rainbowIntensity: 1.0,
  transparency: 0.4,
  shininess: 64.0,
}

function BubbleScene({ settings }: { settings: Required<BubbleOrbSettings> }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(settings.baseColor) },
    uFilmThickness: { value: settings.filmThickness },
    uFilmSpeed: { value: settings.filmSpeed },
    uDeformAmount: { value: settings.deformAmount },
    uDeformFreq: { value: settings.deformFreq },
    uFresnelPower: { value: settings.fresnelPower },
    uRainbowIntensity: { value: settings.rainbowIntensity },
    uTransparency: { value: settings.transparency },
    uShininess: { value: settings.shininess },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (!matRef.current) return
    const u = matRef.current.uniforms
    u.uTime.value += delta * settings.deformSpeed
    u.uBaseColor.value.set(settings.baseColor)
    u.uFilmThickness.value = settings.filmThickness
    u.uFilmSpeed.value = settings.filmSpeed
    u.uDeformAmount.value = settings.deformAmount
    u.uDeformFreq.value = settings.deformFreq
    u.uFresnelPower.value = settings.fresnelPower
    u.uRainbowIntensity.value = settings.rainbowIntensity
    u.uTransparency.value = settings.transparency
    u.uShininess.value = settings.shininess
  })

  const vertexShader = `
    uniform float uTime;
    uniform float uDeformAmount;
    uniform float uDeformFreq;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    varying float vDisplacement;

    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.,0.5,1.,2.);
      vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;
      vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
      i=mod(i,289.0);
      vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
      float n_=1.0/7.0;vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
      vec4 x2_=x_*ns.x+ns.yyyy;vec4 y2_=y_*ns.x+ns.yyyy;
      vec4 h=1.0-abs(x2_)-abs(y2_);vec4 b0=vec4(x2_.xy,y2_.xy);vec4 b1=vec4(x2_.zw,y2_.zw);
      vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;
      vec4 sh=-step(h,vec4(0.));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
      return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }

    void main() {
      float n = snoise(position * uDeformFreq + uTime);
      float displacement = n * uDeformAmount;
      vDisplacement = displacement;
      vec3 newPos = position + normal * displacement;
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(newPos, 1.0)).xyz;
      vWorldPosition = (modelMatrix * vec4(newPos, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
  `

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uBaseColor;
    uniform float uFilmThickness;
    uniform float uFilmSpeed;
    uniform float uFresnelPower;
    uniform float uRainbowIntensity;
    uniform float uTransparency;
    uniform float uShininess;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    varying float vDisplacement;

    // Thin film interference - simplified
    vec3 thinFilmColor(float cosAngle, float thickness) {
      float delta = thickness * cosAngle * 2.0;
      vec3 color;
      color.r = 0.5 + 0.5 * cos(delta * 12.0 + 0.0);
      color.g = 0.5 + 0.5 * cos(delta * 12.0 + 2.094);
      color.b = 0.5 + 0.5 * cos(delta * 12.0 + 4.189);
      return color;
    }

    void main() {
      vec3 viewDir = normalize(-vPosition);
      vec3 normal = normalize(vNormal);
      float cosAngle = abs(dot(normal, viewDir));

      // Fresnel
      float fresnel = pow(1.0 - cosAngle, uFresnelPower);

      // Animated film thickness
      float thickness = uFilmThickness + sin(vWorldPosition.x * 3.0 + uTime * uFilmSpeed) * 0.1
                       + sin(vWorldPosition.y * 4.0 + uTime * uFilmSpeed * 0.7) * 0.08
                       + vDisplacement * 2.0;

      // Rainbow interference
      vec3 rainbow = thinFilmColor(cosAngle, thickness) * uRainbowIntensity;

      // Specular
      vec3 lightDir = normalize(vec3(2.0, 3.0, 4.0));
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), uShininess);

      vec3 lightDir2 = normalize(vec3(-1.0, -2.0, 3.0));
      vec3 halfDir2 = normalize(lightDir2 + viewDir);
      float spec2 = pow(max(dot(normal, halfDir2), 0.0), uShininess * 0.5) * 0.3;

      // Combine
      vec3 color = uBaseColor * 0.2; // ambient
      color += rainbow * (0.3 + fresnel * 0.7); // iridescence
      color += vec3(1.0) * (spec + spec2) * 0.8; // specular highlights
      color += uBaseColor * fresnel * 0.3; // fresnel rim

      float alpha = uTransparency + fresnel * (1.0 - uTransparency);

      gl_FragColor = vec4(color, alpha);
    }
  `

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.5, 32]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export function BubbleOrb({ settings, className }: { settings?: BubbleOrbSettings; className?: string }) {
  const s = { ...defaultSettings, ...settings }
  return (
    <div className={className ?? "relative h-full w-full"}>
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} gl={{ alpha: true, antialias: true }}>
        <BubbleScene settings={s} />
      </Canvas>
    </div>
  )
}

export { defaultSettings as bubbleOrbDefaults }
