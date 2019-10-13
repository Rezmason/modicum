// @author Jeremy Sachs
// @version 2.0.0

import Modicum from "./modicum.js";
import { makeResizer, makeAnimator } from "./modicumHelpers.js";
const mat3 = glMatrix.mat3;

document.body.onload = async () => {
  const modicum = new Modicum();
  document.body.appendChild(modicum.canvas);

  const program = await modicum.loadProgram("shaders/flatshapes.vert");

  const scene = program.makeUniformGroup();
  const camera = mat3.create();
  scene.setUniforms({
    uColorPalette: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    uAlpha: [1.0]
  });

  const mesh1 = program
    .makeMesh(6, 2)
    .setVertex(0, { aShape: [0, 0, 0, 480, 640, 0], aColor: [3, 3, 3] })
    .setVertex(3, { aShape: [0, 480, 640, 0, 640, 480], aColor: [1, 1, 1] })
    .setIndex(0, [0, 1, 2, 3, 4, 5])
    .setUniforms({ uTransform: mat3.create() })
    .update();

  const mesh2 = program
    .makeMesh(3, 1)
    .setVertex(0, {
      aShape: [320, 100, 100, 480 - 100, 640 - 100, 480 - 100],
      aColor: [0, 0, 0]
    })
    .setIndex(0, [0, 1, 2])
    .setUniforms({ uTransform: mat3.create() })
    .update();

  program.activate();

  let alpha = 0;

  const resizer = makeResizer(modicum, (width, height) => {
    mat3.identity(camera);
    mat3.scale(camera, camera, [1, -1]);
    mat3.translate(camera, camera, [-1, -1]);
    mat3.scale(camera, camera, [2 / width, 2 / height]);
    scene.setUniforms({ uCamera: camera });
    redraw();
  });

  const animator = makeAnimator(time => {
    alpha = Math.sin(time * 2) / 2 + 0.5;
    redraw();
  });

  const redraw = () => {
    modicum.clear();
    scene.setUniforms({ uAlpha: [1.0] });
    program.drawMesh(mesh1, scene);
    scene.setUniforms({ uAlpha: [alpha] });
    program.drawMesh(mesh2, scene);
  };

  window.onresize = resizer;
  resizer();
  animator.start();
};
