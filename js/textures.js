// @author Jeremy Sachs
// @version 2.0.0

import Modicum from "./modicum.js";
import { makeResizer, makeAnimator } from "./modicumHelpers.js";
const { vec3, mat4 } = glMatrix;

document.body.onload = async () => {
  const modicum = new Modicum();
  document.body.appendChild(modicum.canvas);
  await modicum.installTextures();
  const program = await modicum.loadProgram(
    "shaders/textured.vert",
    "shaders/textured.frag"
  );
  const scene = program.makeUniformGroup();
  const camera = mat4.create();

  const transform1 = mat4.create();
  mat4.translate(transform1, transform1, vec3.fromValues(-1, 0, 0));
  mat4.scale(transform1, transform1, vec3.fromValues(0.5, 0.5, 0.5));
  const mesh1 = program
    .makeMesh(4, 2)
    .setVertex(0, {
      aPos: [-1, 1, 0, -1, -1, 0, 1, 1, 0, 1, -1, 0],
      aUV: [0, 0, 0, 1, 1, 0, 1, 1]
    })
    .setIndex(0, [0, 1, 3, 0, 3, 2])
    .setUniforms({
      uSampler: await modicum.loadImageTexture("assets/crate.bmp"),
      uTransform: transform1
    })
    .update();

  const transform2 = mat4.create();
  mat4.translate(transform2, transform2, vec3.fromValues(1, 0, 0));
  mat4.scale(transform2, transform2, vec3.fromValues(0.5, 0.5, 0.5));
  const mesh2 = program
    .makeMesh(4, 2)
    .setVertex(0, {
      aPos: [-1, 1, 0, -1, -1, 0, 1, 1, 0, 1, -1, 0],
      aUV: [0, 0, 0, 1, 1, 0, 1, 1]
    })
    .setIndex(0, [0, 1, 3, 0, 3, 2])
    .setUniforms({
      uSampler: await modicum.loadImageTexture("assets/webgl.bmp"),
      uTransform: transform2
    })
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
    mat4.rotateZ(transform1, transform1, delta);
    mesh1.setUniforms({ uTransform: transform1 });
    mat4.rotateZ(transform2, transform2, delta);
    mesh2.setUniforms({ uTransform: transform2 });
    redraw();
  });

  const redraw = () => {
    modicum.clear(null, true);
    program.drawMesh(mesh1, scene);
    program.drawMesh(mesh2, scene);
  };

  window.onresize = resize;
  resize();
  animator.start();
};
