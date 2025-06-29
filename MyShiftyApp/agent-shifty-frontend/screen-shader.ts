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
uniform vec2 resolution;
uniform float time;
uniform float opacity;

in vec2 vUv;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
  // Glitchy texture lookup
  vec2 uv = vUv;
  float glitchAmount = sin(time * 5.0 + uv.y * 20.0) * 0.003;
  if (rand(vec2(time, 1.0)) > 0.98) {
      uv.y += (rand(uv) - 0.5) * 0.1 * (rand(vec2(time, 2.0)) - 0.5);
  }
  uv.x += glitchAmount;
  
  vec4 color = texture(tDiffuse, uv);

  // Discard black pixels from the source image background
  if (color.r + color.g + color.b < 0.1) {
      discard;
  }

  // Scanlines
  float scanline = sin(vUv.y * 600.0) * 0.05;
  color.rgb -= scanline;

  // Vignette
  float d = length(vUv * 2.0 - 1.0);
  color.rgb *= pow(1.0 - d * 0.4, 1.5);
  
  // Flicker
  color.rgb *= (0.95 + rand(vec2(time, uv.y)) * 0.1);

  fragmentColor = vec4(color.rgb, color.a * pow(1.0 - d, 2.0) * opacity);
}
`;

export {fs, vs};