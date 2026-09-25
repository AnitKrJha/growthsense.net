/**
 * Paper material: MeshStandardMaterial plus three vertex tricks (cylindrical curl, a lifted corner and a
 * travelling flutter), with normals bent to match so the light rolls across the sheet. The back face samples
 * a plain paper texture instead of a mirrored print.
 *
 * Ink material: the FILED impression, revealed by a noise threshold so ink "bleeds" outward from the centre.
 */
import { Color, DoubleSide, MeshStandardMaterial, ShaderMaterial, type Texture } from 'three';
import { HERO } from '../engine/config';

export interface PaperUniforms {
  uCurl: { value: number };
  uCorner: { value: number };
  uFlutter: { value: number };
  uTime: { value: number };
  uPhase: { value: number };
  uHalf: { value: [number, number] };
  uBack: { value: Texture | null };
}

export type PaperMaterial = MeshStandardMaterial & { userData: { u: PaperUniforms } };

const VERT_PARS = /* glsl */ `
uniform float uCurl;
uniform float uCorner;
uniform float uFlutter;
uniform float uTime;
uniform float uPhase;
uniform vec2 uHalf;
float gsLift(vec2 p) {
  vec2 n = p / uHalf;
  float corner = max(0.0, (n.x + n.y) * 0.5);
  return uCurl * n.x * n.x
    + uCorner * corner * corner * corner
    + uFlutter * sin(n.x * 2.6 + n.y * 1.7 + uTime * 2.1 + uPhase);
}
`;

const VERT_NORMAL = /* glsl */ `
vec2 gsP = position.xy;
float gsE = 0.002;
float gsDx = (gsLift(gsP + vec2(gsE, 0.0)) - gsLift(gsP - vec2(gsE, 0.0))) / (2.0 * gsE);
float gsDy = (gsLift(gsP + vec2(0.0, gsE)) - gsLift(gsP - vec2(0.0, gsE))) / (2.0 * gsE);
vec3 objectNormal = normalize(vec3(-gsDx, -gsDy, 1.0));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3( tangent.xyz );
#endif
`;

const VERT_BEGIN = /* glsl */ `
vec3 transformed = vec3(position);
transformed.z += gsLift(position.xy);
`;

const FRAG_PARS = /* glsl */ `
uniform sampler2D uBack;
`;

const FRAG_MAP = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = gl_FrontFacing
    ? texture2D( map, vMapUv )
    : texture2D( uBack, vec2( 1.0 - vMapUv.x, vMapUv.y ) );
  diffuseColor *= sampledDiffuseColor;
#endif
`;

export function createPaperMaterial(map: Texture, back: Texture, phase: number): PaperMaterial {
  const mat = new MeshStandardMaterial({
    map,
    roughness: HERO.paper.roughness,
    metalness: 0,
    side: DoubleSide,
  }) as PaperMaterial;
  const u: PaperUniforms = {
    uCurl: { value: HERO.paper.curlIdle },
    uCorner: { value: HERO.paper.cornerIdle },
    uFlutter: { value: HERO.paper.flutterIdle },
    uTime: { value: 0 },
    uPhase: { value: phase },
    uHalf: { value: [HERO.paper.w / 2, HERO.paper.h / 2] },
    uBack: { value: back },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <beginnormal_vertex>', VERT_NORMAL)
      .replace('#include <begin_vertex>', VERT_BEGIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <map_fragment>', FRAG_MAP);
  };
  mat.customProgramCacheKey = () => 'gs-paper';
  return mat;
}

export function createInkMaterial(map: Texture, noise: Texture): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    uniforms: {
      uMap: { value: map },
      uNoise: { value: noise },
      uInk: { value: 0 },
      uOpacity: { value: HERO.impression.opacity },
      uColor: { value: new Color('#c93126').convertSRGBToLinear() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform sampler2D uNoise;
      uniform float uInk;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float art = texture2D(uMap, vUv).a;
        vec2 nz = texture2D(uNoise, vUv).rg;
        // Spread: the noise field (biased low in the centre) is swept by uInk.
        float spread = smoothstep(nz.r - 0.08, nz.r + 0.02, uInk * 1.12);
        // Rubber grain: a few pores never take ink.
        float pores = smoothstep(0.18, 0.3, nz.g + 0.25 * uInk);
        float a = art * spread * pores * uOpacity;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }
    `,
  });
}
