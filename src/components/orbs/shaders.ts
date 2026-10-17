/**
 * Fragment shaders for the console's orbs. Each is prefixed with
 * SHADER_HEADER (uniform declarations) by ShaderOrb, and outputs
 * premultiplied colour on a transparent canvas.
 */

/** 3D simplex noise — Ashima Arts / Ian McEwan (MIT), plus fbm + band lookup. */
const LIB = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
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
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
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
float fbm(vec3 p){
  float v=0.0,a=0.5;
  for(int i=0;i<5;i++){v+=a*snoise(p);p=p*2.02+vec3(1.7,9.2,3.1);a*=0.5;}
  return v;
}
float band(float x){
  float f=clamp(x,0.0,1.0)*15.0;
  int i=int(floor(f));
  int j=min(i+1,15);
  return mix(u_bands[i],u_bands[j],fract(f));
}
// Orb space: [-1,1] spans the orb's layout box (the canvas bleeds past it).
vec2 orbSpace(){return (gl_FragCoord.xy*2.0-u_res)/min(u_res.x,u_res.y)*u_bleed;}
// One device pixel, in orb-space units — for resolution-independent edges.
float pxUnit(){return 2.0*u_bleed/min(u_res.x,u_res.y);}
// Circular fade to zero before the canvas edge, so a glow can never show a box.
float edgeFade(){return 1.0-smoothstep(0.6,0.97,length(v_uv*2.0-1.0));}
vec4 emit(vec3 col){
  col=1.0-exp(-col*1.25);
  float a=clamp(max(col.r,max(col.g,col.b)),0.0,1.0);
  return vec4(col,a)*edgeFade();
}
`;

/** HALO — three swirling aurora lobes on a breathing ring (Siri-like). */
export const HALO = LIB + /* glsl */ `
void main(){
  vec2 p=orbSpace()*1.08;
  float r=length(p);
  float a=atan(p.y,p.x);
  float t=u_time;
  float idle=u_state.x, listen=u_state.y, think=u_state.z, speak=u_state.w;
  float swirl=0.22+think*1.5+u_connecting*0.7+speak*0.35;
  float R=0.6+0.025*sin(t*0.9)*(idle+u_connecting)+u_energy*0.09;
  vec3 col=vec3(0.0);
  for(int k=0;k<3;k++){
    float fk=float(k);
    float dir=(k==1)?-1.0:1.0;
    float ang=a+t*swirl*(0.55+0.3*fk)*dir+fk*2.094;
    float wob=0.045*sin(3.0*ang+t*1.2+fk)*(0.35+u_energy*1.6);
    wob+=0.03*sin(5.0*ang-t*1.9+fk*1.3)*(0.25+think*1.2);
    wob+=band(abs(fract((a+PI)/TAU+fk*0.21)*2.0-1.0))*0.2*(speak+listen*0.7);
    float d=abs(r-(R+wob));
    float w=0.03+0.045*u_energy+0.02*think;
    float lobe=pow(0.5+0.5*cos(ang),2.2);
    vec3 c=(k==0)?u_c1:((k==1)?u_c2:u_c3);
    col+=c*(exp(-d*d/(w*w))*(0.35+1.1*lobe)+exp(-d*7.0)*0.28*lobe);
  }
  float inner=smoothstep(R,0.0,r);
  col+=mix(u_c1,u_c2,0.5+0.5*sin(a*2.0+t*0.7))*inner*inner*(0.05+0.18*u_energy);
  col*=0.8+0.2*sin(t*3.2)*u_connecting+0.55*u_energy;
  fragColor=emit(col);
}`;

/** LIQUID — ray-marched glossy blob, iridescent fresnel, audio-driven displacement. */
export const LIQUID = LIB + /* glsl */ `
float gAmp; float gRip;
float map(vec3 p){
  float t=u_time;
  float n=snoise(p*1.1+vec3(0.0,t*0.3,t*0.2));
  n+=0.25*snoise(p*2.4-vec3(t*0.4));
  float ang=atan(p.z,p.x);
  float lat=clamp(p.y*0.6+0.5,0.0,1.0);
  float rip=gRip*band(lat)*sin(ang*5.0+t*4.0+p.y*6.0);
  return length(p)-(0.7+gAmp*n+rip);
}
vec3 normalAt(vec3 p){
  vec2 e=vec2(0.002,-0.002);
  return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));
}
void main(){
  vec2 uv=orbSpace()*1.05;
  float idle=u_state.x, listen=u_state.y, think=u_state.z, speak=u_state.w;
  gAmp=0.03+0.05*think+0.04*u_connecting+0.24*u_energy*(speak+listen*0.75);
  gRip=0.09*speak+0.04*listen;
  vec3 ro=vec3(0.0,0.0,2.6);
  vec3 rd=normalize(vec3(uv,-2.1));
  // Bounding sphere: skip rays that cannot hit.
  float bb=dot(ro,rd); float cc=dot(ro,ro)-1.25*1.25; float h=bb*bb-cc;
  vec3 col=vec3(0.0);
  float alpha=0.0;
  float glow=0.0;
  if(h>0.0){
    float tt=-bb-sqrt(h);
    float minD=1e9;
    float minT=tt;
    bool hit=false;
    for(int i=0;i<48;i++){
      float d=map(ro+rd*tt);
      if(d<minD){minD=d;minT=tt;}
      if(d<0.001){hit=true;break;}
      tt+=d*0.8;
      if(tt>4.2)break;
    }
    glow=exp(-max(minD,0.0)*16.0);
    // Anti-aliased silhouette: rays that pass within ~1.5px of the surface get
    // fractional coverage, shaded at their closest approach.
    float px=pxUnit()*1.05;
    float cover=hit?1.0:1.0-smoothstep(0.0,px*1.5,minD);
    if(cover>0.0){
      vec3 pos=ro+rd*(hit?tt:minT);
      vec3 n=normalAt(pos);
      // Polished metal: the reflected ray samples a palette "studio" (ground →
      // horizon → sky), tinted by thin-film iridescence toward the rim.
      vec3 rf=reflect(rd,n);
      float fres=pow(1.0-max(dot(n,-rd),0.0),3.0);
      vec3 env=mix(u_c2*0.3,u_c1,smoothstep(-0.7,0.15,rf.y));
      env=mix(env,u_c3,smoothstep(0.15,0.95,rf.y));
      env+=u_c2*0.35*smoothstep(0.6,1.0,-rf.x)*(0.5+0.5*rf.y);
      vec3 irid=0.5+0.5*cos(TAU*(fres*0.8+rf.y*0.25+u_time*0.04+vec3(0.0,0.33,0.67)));
      vec3 l=normalize(vec3(-0.5,0.8,0.6));
      float spec=pow(max(dot(rf,l),0.0),64.0);
      float rim=pow(1.0-max(dot(n,-rd),0.0),5.0);
      col=env*(0.6+0.4*fres)+irid*mix(vec3(1.0),u_c3,0.5)*fres*0.55+vec3(spec)*1.5+u_c3*rim*0.5;
      col*=0.9+0.5*u_energy;
      alpha=cover;
    }
  }
  vec3 halo=mix(u_c1,u_c2,0.5)*glow*(0.25+0.6*u_energy+0.25*think);
  // Premultiplied: surface (coverage-weighted) over the glow.
  vec3 surf=(1.0-exp(-col*1.3))*alpha;
  vec3 gl=(1.0-exp(-halo*1.3))*(1.0-alpha);
  vec3 outc=surf+gl;
  float a=clamp(alpha+(1.0-alpha)*max(gl.r,max(gl.g,gl.b)),0.0,1.0);
  fragColor=vec4(outc,a)*edgeFade();
}`;

/** NEBULA — a living gas sphere: domain-warped fbm on a rotating globe, limb glow, corona. */
export const NEBULA = LIB + /* glsl */ `
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.0,-s,0.0,1.0,0.0,s,0.0,c);}
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.0,0.0,0.0,0.0,c,s,0.0,-s,c);}
void main(){
  vec2 p=orbSpace()*1.1;
  float r=length(p);
  float a=atan(p.y,p.x);
  float t=u_time;
  float idle=u_state.x, listen=u_state.y, think=u_state.z, speak=u_state.w;
  float R=0.66+u_energy*0.05+0.015*sin(t*1.1);
  vec3 col=vec3(0.0);
  float alpha=0.0;
  if(r<R){
    float z=sqrt(max(R*R-r*r,0.0));
    vec3 sp=vec3(p,z)/R;
    sp=rotX(0.35)*rotY(t*(0.12+0.5*think))*sp;
    float flow=t*(0.08+0.35*think+0.25*u_energy);
    vec3 q=sp*1.6;
    vec3 w=vec3(fbm(q+vec3(0.0,flow,0.0)),fbm(q+vec3(5.2,1.3,flow)),fbm(q-vec3(flow,2.8,0.0)));
    float dens=fbm(q+2.2*w+vec3(0.0,0.0,flow*0.5));
    dens=0.5+0.5*dens;
    dens+=band(clamp(sp.y*0.5+0.5,0.0,1.0))*0.55*(speak+listen*0.6);
    vec3 c=mix(u_c2*0.5,u_c1,smoothstep(0.2,0.65,dens));
    c=mix(c,u_c3,smoothstep(0.58,0.95,dens)*0.9);
    float limb=pow(z/R,0.45);
    float rimGlow=pow(1.0-z/R,3.0);
    col=c*limb*(1.0+0.8*u_energy)+u_c3*rimGlow*(0.5+0.8*u_energy)+u_c1*rimGlow*0.7;
    alpha=1.0-smoothstep(R-pxUnit()*1.6,R,r);
  }
  float d=max(r-R,0.0);
  float spikes=0.0;
  for(int k=0;k<16;k++){
    float ang=float(k)/16.0*TAU+t*0.1;
    float da=abs(atan(sin(a-ang),cos(a-ang)));
    spikes+=exp(-da*da*90.0)*u_bands[k];
  }
  float corona=exp(-d*(9.0-6.0*u_energy))*(0.35+0.5*u_energy+0.3*think)+spikes*exp(-d*5.0)*0.9*(speak+listen*0.5);
  vec3 cor=mix(u_c1,u_c2,0.5+0.5*sin(a*3.0+t))*corona*(1.0-alpha);
  vec3 outc=1.0-exp(-(col+cor)*1.2);
  float oa=max(alpha,clamp(max(outc.r,max(outc.g,outc.b)),0.0,1.0));
  outc*=1.0-0.35*u_connecting*(0.5+0.5*sin(t*3.0));
  fragColor=vec4(outc,oa)*edgeFade();
}`;

/** PULSE — radial spectrum instrument: mirrored FFT bars, glowing core, ripples. */
export const PULSE = LIB + /* glsl */ `
void main(){
  vec2 p=orbSpace()*1.1;
  float r=length(p);
  float a=atan(p.y,p.x);
  float t=u_time;
  float idle=u_state.x, listen=u_state.y, think=u_state.z, speak=u_state.w;
  const float BARS=56.0;
  float R0=0.44+u_energy*0.03;
  float cell=(a+PI)/TAU*BARS;
  float idx=floor(cell);
  float fx=fract(cell)-0.5;
  float mirror=abs(fract(idx/BARS+0.25)*2.0-1.0);
  float lvl=band(mirror)*(speak+listen*0.8);
  float breathe=0.03+0.02*sin(t*1.6+idx*0.45)*(idle+u_connecting);
  float hgt=breathe+lvl*0.42+think*0.05*(0.5+0.5*sin(idx*0.7+t*6.0));
  float arc=r*TAU/BARS;
  float bw=0.36;
  float across=abs(fx)*arc;
  float along=r-R0;
  float capd=max(along-hgt,0.0)+max(-along,0.0);
  float bar=1.0-smoothstep(0.0,0.012,length(vec2(max(across-arc*bw*0.5,0.0),capd)));
  vec3 bc=mix(u_c1,u_c3,clamp(along/max(hgt,0.05),0.0,1.0));
  vec3 col=bc*bar*(0.55+1.2*lvl+0.2*think);
  float core=smoothstep(0.36,0.0,r);
  col+=mix(u_c2,u_c1,core)*core*(0.25+0.9*u_energy);
  col+=u_c2*exp(-abs(r-0.36)*40.0)*0.6;
  float comet=pow(0.5+0.5*cos(a-t*4.0),24.0)*exp(-abs(r-0.39)*60.0);
  col+=u_c3*comet*(think*1.6+u_connecting*1.2);
  for(int k=0;k<3;k++){
    float ph=fract(t*0.45+float(k)/3.0);
    float rr=R0+0.05+ph*0.55;
    col+=mix(u_c1,u_c2,ph)*exp(-abs(r-rr)*70.0)*(1.0-ph)*(u_energy*1.4+0.05);
  }
  fragColor=emit(col);
}`;
