attribute vec2 aShape;
attribute float aColor;
uniform float uAlpha;
uniform vec3 uColorPalette[ 4 ];
uniform mat3 uTransform;
uniform mat3 uCamera;
varying vec4 vColor;

void main(void) {
    gl_Position = vec4(uCamera * uTransform * vec3(aShape, 1.0), 1.0);
    vec4 color = vec4(uColorPalette[int(aColor)], uAlpha);
    vColor = color;
}
