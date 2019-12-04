// @author Jeremy Sachs
// @version 2.0.0

import Modicum from "./modicum.js";
import { makeResizer, makeAnimator } from "./modicumHelpers.js";
const { vec3, mat4 } = glMatrix;

document.body.onload = async () => {
  const modicum = new Modicum();
  document.body.appendChild(modicum.canvas);
  await modicum.installTextures();

  const renderTexture = await modicum.makeTexture(1, 1, [], { isFloat: true });

  // 1. Animate something, render it to a texture

  const program = await modicum.loadProgram(
    "shaders/textured.vert",
    "shaders/textured.frag"
  );
  const scene = program.makeUniformGroup();
  const camera = mat4.create();
  const transform = mat4.create();
  scene.setUniforms({
    uSampler: await modicum.loadImageTexture("assets/crate.bmp"),
    uTransform: transform
  });

  const mesh = program
    .makeMesh(4, 2)
    .setVertex(0, {
      aPos: [-1, -1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
      aUV: [0, 0, 0, 1, 1, 0, 1, 1]
    })
    .setIndex(0, [0, 1, 3, 0, 3, 2])
    .update();

  program.activate();

  const { resize } = makeResizer(modicum, (width, height) => {
    const aspectRatio = width / height;
    mat4.perspective(camera, (Math.PI / 180) * 90, aspectRatio, 0.0001, 1000);
    mat4.translate(camera, camera, vec3.set(vec3.create(), 0, 0, -1));
    scene.setUniforms({ uCamera: camera });
    redraw();
  });

  const animator = makeAnimator((time, delta) => {
    mat4.rotateZ(transform, transform, delta);
    scene.setUniforms({ uTransform: transform });
    redraw();
  });

  const redraw = () => {
    modicum.clear(null, true);
    program.drawMesh(mesh, scene);
  };

  window.onresize = resize;
  resize();
  animator.start();
};
