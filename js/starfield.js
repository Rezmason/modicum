// @fileoverview starfield - An old coding challenge, remade and improved in WebGL
// @author Jeremy Sachs
// @version 2.0.0

import Modicum from "./modicum.js";
import AudioAnalyser from "./audioanalyser.js";
import { colorTemperature2rgb } from "./../lib/color-temperature.js";
import { rgbToHSV, hsvToRGB } from "./rgb_hsv.js";
const { mat4, mat2, vec3 } = glMatrix;

const makeStarColor = val => {
  const temperature = Math.pow(val, 2) * 15000;
  const starColor = colorTemperature2rgb(temperature);
  const hsv = rgbToHSV(starColor);
  hsv.s = hsv.s * 0.8 + 0.2;
  const { r, g, b } = hsvToRGB(hsv);
  return [r, g, b];
};

document.body.onload = async () => {
  const audioAnalyser = new AudioAnalyser("./../assets/09 New Lands.wav");

  const starSize = 0.007;
  const numStars = 100;
  const numMeshes = audioAnalyser.binCount;
  const zGoalSpeed = 0.1;
  const turnSpeed = 0.3;
  const starAngleDeg = 0;

  let zSpeed = 0.0;
  let rotateX = 0.0;
  let rotateY = 0.0;
  let rotateXGoal = 0.0;
  let rotateYGoal = 0.0;

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);

  const modicum = new Modicum(canvas);
  modicum.tweak(gl => {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.DST_ALPHA);
  });
  const program = await modicum.loadProgram(
    "shaders/starfield.vert",
    "shaders/starfield.frag"
  );

  const scene = program.makeUniformGroup();
  const camera = mat4.create();
  const transform = mat4.create();
  const mouseTransform = mat4.create();
  const starTransform = mat2.create();

  mat2.rotate(starTransform, starTransform, (Math.PI / 180) * starAngleDeg);

  scene.setUniforms({
    uZ: [0],
    uCornerOffsets: [[0, 2], [-(3 ** 0.5), -1], [3 ** 0.5, -1]].flat(),
    uStarSize: [starSize],
    uMouse: mouseTransform,
    uTransform: transform,
    uStarTransform: starTransform,
    uMinDecibels: [audioAnalyser.minDecibels],
    uMaxDecibels: [audioAnalyser.maxDecibels],
    uColor: [1, 1, 1]
  });

  const verticesPerStar = 3;
  const indicesPerTriangle = 3;
  const trianglesPerStar = 1;
  const indicesPerStar = trianglesPerStar * indicesPerTriangle;
  const starIndexTemplate = [0, 1, 2];

  const starVertexIDs = Array(verticesPerStar * numStars)
    .fill()
    .map((_, i) => i);
  const starMeshIDs = Array(verticesPerStar * numStars);
  const starIndices = Array(numStars)
    .fill()
    .map((_, i) => starIndexTemplate.map(index => index + i * verticesPerStar));

  const meshes = Array(numMeshes)
    .fill()
    .map((_, meshID) => {
      const starPositions = Array(numStars)
        .fill()
        .map(() => {
          const r = Math.random() ** 0.5;
          const theta = Math.random() * Math.PI * 2;
          return [Math.cos(theta) * r, Math.sin(theta) * r, Math.random()];
        });
      const starVertexPositions = starPositions.map(position =>
        Array(verticesPerStar).fill(position)
      );

      const starSizes = Array(numStars)
        .fill()
        .map(() => Math.random() ** 2 + 0.2);
      const starVertexSizes = starSizes.map(size =>
        Array(verticesPerStar).fill(size)
      );

      const starMesh = program.makeMesh(
        verticesPerStar * numStars,
        trianglesPerStar * numStars
      );
      starMesh.setVertex(0, {
        aPos: starVertexPositions.flat(2),
        aSize: starVertexSizes.flat(2),
        aVertexID: starVertexIDs,
        aMeshID: starMeshIDs.fill(meshID)
      });
      const starColor = makeStarColor(meshID / audioAnalyser.binCount);
      starMesh.setUniforms({ uColor: starColor });
      starMesh.setIndex(0, starIndices.flat(2));
      starMesh.update();
      return starMesh;
    });

  program.activate();

  let z = 0;
  let lastTime = 0;

  const resize = () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const aspectRatio = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(camera, (Math.PI / 180) * 90, aspectRatio, 0.0001, 1000);
    scene.setUniforms({ uCamera: camera, uAspectRatio: [1 / aspectRatio, 1] });
    modicum.resize();
    redraw();
  };

  const animate = time => {
    const delta = (time - lastTime) / 1000;
    lastTime = time;
    z += delta * zSpeed;
    mat4.rotateZ(
      transform,
      transform,
      Math.PI * 2 * turnSpeed * delta * zSpeed
    );
    if (audioAnalyser.playing && zSpeed < zGoalSpeed) {
      zSpeed = Math.min(zGoalSpeed, zSpeed + delta * 0.05);
    } else if (!audioAnalyser.playing && zSpeed > 0) {
      zSpeed = Math.max(0, zSpeed - delta * 0.08);
    }
    audioAnalyser.update();

    mat4.identity(mouseTransform);
    mat4.rotateX(mouseTransform, mouseTransform, rotateX);
    mat4.rotateY(mouseTransform, mouseTransform, rotateY);
    rotateX = rotateX * 0.9 + rotateXGoal * 0.1;
    rotateY = rotateY * 0.9 + rotateYGoal * 0.1;

    redraw();
    window.requestAnimationFrame(animate);
  };

  const redraw = () => {
    modicum.clear();
    scene.setUniforms({
      uZ: [z],
      uDecibels: audioAnalyser.data,
      uTransform: transform,
      uMouse: mouseTransform
    });
    meshes.forEach(mesh => program.drawMesh(mesh, scene));
  };

  const mouseMove = ({ x, y }) => {
    rotateXGoal = Math.PI * 2 * (y / canvas.height - 0.5);
    rotateYGoal = Math.PI * 2 * (x / canvas.width - 0.5);
  };

  resize();
  window.onresize = resize;
  window.onmousemove = mouseMove;
  animate(0);

  window.onclick = async () => {
    if (audioAnalyser.playing) {
      audioAnalyser.stop();
    } else {
      audioAnalyser.play();
    }
  };
};
