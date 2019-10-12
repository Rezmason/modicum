attribute vec3 aPos;
attribute vec2 aUV;
uniform mat4 uCamera;
uniform mat4 uTransform;
varying vec2 vUV;

void main(void) {
  vUV = aUV;
  gl_Position = uCamera * uTransform * vec4(aPos, 1.0);
}
