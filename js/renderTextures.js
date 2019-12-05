// @author Jeremy Sachs
// @version 2.0.0

import Modicum from "./modicum.js";
import { makeResizer, makeAnimator } from "./modicumHelpers.js";
const { vec3, mat4 } = glMatrix;

document.body.onload = async () => {
  const modicum = new Modicum();
  document.body.appendChild(modicum.canvas);
  await modicum.installTextures();

  const renderTexture = await modicum.makeTexture(1, 1, null, {
    isFloat: true
  });

  const screenQuadIndices = [0, 1, 3, 0, 3, 2];
  const screenQuadPositions = [-1, -1, -1, 1, 1, -1, 1, 1];
  const vertexShader = `
    attribute vec2 aPos;
    varying vec2 vUV;
    void main(void) {
      vUV = (aPos + 1.) * 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
    `;

  const program1 = modicum.makeProgram(
    vertexShader,
    `
    precision mediump float;
    varying vec2 vUV;
    uniform float uTime;
    void main(void) {
      gl_FragColor = vec4(abs(fract(vUV + uTime) - 0.5) * 2., 0., 1.0);
    }
    `
  );

  const mesh1 = program1
    .makeMesh(4, 2)
    .setVertex(0, { aPos: screenQuadPositions })
    .setIndex(0, screenQuadIndices)
    .update()
    .setUniforms({ uTime: [0] });

  const program2 = modicum.makeProgram(
    vertexShader,
    `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uSampler;
    uniform float uTime;
    void main(void) {
      gl_FragColor = vec4(texture2D(uSampler, vUV).rg, fract(uTime), 1.0);
    }
    `
  );

  const mesh2 = program2
    .makeMesh(4, 2)
    .setVertex(0, { aPos: screenQuadPositions })
    .setIndex(0, screenQuadIndices)
    .update()
    .setUniforms({ uTime: [0], uSampler: renderTexture });

  const { resize } = makeResizer(modicum, (width, height) => {
    redraw();
  });

  const animator = makeAnimator((time, delta) => {
    mesh1.setUniforms({ uTime: [time] });
    mesh2.setUniforms({ uTime: [time] });
    redraw();
  });

  const redraw = () => {
    modicum.clear(null);
    program1.activate();
    program1.drawMesh(mesh1);
    program1.deactivate();

    program2.activate();
    program2.drawMesh(mesh2);
    program2.deactivate();
  };

  window.onresize = resize;
  resize();
  animator.start();
};
