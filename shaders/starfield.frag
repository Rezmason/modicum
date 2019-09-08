precision mediump float;

uniform vec3 uColor;
varying vec2 vUV;

void main(void) {

  float distFromCenter = length(vUV);

  if (distFromCenter > 1.0) {
    discard;
  }

  // uColor;
  // gl_FragColor = vec4(vUV / 2.0 + 0.5, 0.5, 1.0);

  float haze = (1.0 - distFromCenter);
  float sparkle = clamp(1.0 - (abs(vUV.x * vUV.y) * 30.0), 0.0, 1.0);
  gl_FragColor = vec4(clamp(uColor * haze + sparkle, 0.0, 1.0), 1.0);
}
