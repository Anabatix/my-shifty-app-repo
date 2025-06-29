/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const vs = `
precision highp float;

in vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const fs = `
precision highp float;

out vec4 fragmentColor;

uniform vec2 resolution;
uniform float rand;

void main() {
  float aspectRatio = resolution.x / resolution.y; 
  vec2 vUv = gl_FragCoord.xy / resolution;
  float noise = fract(sin(dot(vUv, vec2(12.9898 + rand,78.233)*2.0)) * 43758.5453);

  vec2 p = vUv * 2. - 1.;
  p.x *= aspectRatio;

  float d = length(p);
  vec3 color = vec3(0.01, 0.02, 0.05);
  color = mix(color, vec3(0.05, 0.1, 0.2), d);
  
  // Grid
  vec2 gridUv = vUv * vec2(40. * aspectRatio, 40.);
  vec2 gridLines = abs(fract(gridUv) - 0.5);
  float grid = pow(1.0 - max(gridLines.x, gridLines.y), 100.0);
  color += grid * 0.2 * vec3(0.0, 0.8, 1.0);

  // Scanlines
  float scanline = sin(vUv.y * 800.0) * 0.02;
  color.rgb -= scanline;

  // Vignette
  color *= (1.0 - d * 0.5);

  fragmentColor = vec4(color + 0.01 * noise, 1.0);
}
`;

export {fs, vs};