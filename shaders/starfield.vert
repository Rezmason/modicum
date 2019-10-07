attribute vec3 aPos;
attribute float aSize;
attribute float aVertexID;
attribute float aMeshID;
uniform vec2 uCornerOffsets[3];
uniform float uStarSize;
uniform vec2 uAspectRatio;
uniform mat4 uCamera;
uniform mat4 uTransform;
uniform mat4 uMouse;
uniform float uFreqScale;
uniform float uDecibels[128];
uniform float uMinDecibels;
uniform float uMaxDecibels;
uniform float uZ;
uniform mat2 uStarTransform;

varying vec2 vUV;

void main(void) {
    vec4 pos = vec4(aPos, 1.0);
    pos.z = (fract(pos.z + uZ) - 0.5) * 2.0;
    pos = uCamera * uMouse * uTransform * pos;

    float volume = (uDecibels[int(aMeshID * uFreqScale)] - uMinDecibels) / (uMaxDecibels - uMinDecibels);
    volume = pow(volume, 5.0) * 5.0;

    int cornerIndex = int(floor(fract(aVertexID / 3.0) * 3.0));
    vec2 uv = uCornerOffsets[cornerIndex];
    pos.xy += uv * uStarSize * aSize * uAspectRatio * (1.0 + volume) * (1.0 - pos.z);
    vUV = uStarTransform * uv;

    gl_Position = pos;
}
