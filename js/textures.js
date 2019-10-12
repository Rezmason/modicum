// @author Jeremy Sachs
// @version 2.0.0

import Modicum from "./modicum.js";
const { vec3, mat4 } = glMatrix;

document.body.onload = async () => {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const modicum = new Modicum(canvas);
  modicum.tweak(gl => gl.enable(gl.DEPTH_TEST));
  const program = await modicum.loadProgram(
    "shaders/textured.vert",
    "shaders/textured.frag"
  );
  const scene = program.makeUniformGroup();
  const camera = mat4.create();
  const transform = mat4.create();
  scene.setUniforms({
    uSampler: await modicum.loadImageTexture("assets/crate.bmp")
  });

  const mesh = program.makeMesh(4, 2);
  mesh.setVertex(0, {
    aPos: [-1, -1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
    aUV: [0, 0, 0, 1, 1, 0, 1, 1]
  });
  mesh.setIndex(0, [0, 1, 3, 0, 3, 2]);
  mesh.update();

  program.activate();
  let lastTime = 0;

  const resize = () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const aspectRatio = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(camera, (Math.PI / 180) * 90, aspectRatio, 0.0001, 1000);
    mat4.translate(camera, camera, vec3.set(vec3.create(), 0, 0, -1));
    scene.setUniforms({ uCamera: camera });
    modicum.resize();
    redraw();
  };

  const animate = time => {
    const delta = (time - lastTime) / 1000;
    lastTime = time;
    mat4.rotateZ(transform, transform, delta);
    scene.setUniforms({ uTransform: transform });
    redraw();
    window.requestAnimationFrame(animate);
  };

  const redraw = () => {
    modicum.clear(null, true);
    program.drawMesh(mesh, scene);
  };

  window.onresize = resize;
  resize();
  animate(0);
};
