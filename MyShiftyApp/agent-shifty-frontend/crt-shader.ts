/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const vs = `
precision highp float;
out vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fs = `
precision highp float;

out vec4 fragmentColor;

uniform sampler2D tDiffuse;
uniform float time;
uniform float opacity;

in vec2 vUv;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
  vec4 color = texture(tDiffuse, vUv);

  // Scanlines
  float scanline = sin(vUv.y * 600.0) * 0.05;
  color.rgb -= scanline;

  // Vignette
  float d = length(vUv * 2.0 - 1.0);
  color.rgb *= pow(1.0 - d * 0.4, 1.5);
  
  // Flicker
  color.rgb *= (0.95 + rand(vec2(time, vUv.y)) * 0.1);

  fragmentColor = vec4(color.rgb, color.a * opacity);
}
`;

export {fs, vs};