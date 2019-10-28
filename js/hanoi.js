// @fileoverview Hanoi Rings - An eternal Tower of Hanoi solver, depicted as multicolored rings
// @author Jeremy Sachs
// @dedicatedTo my friend Alec McEachran, who likes to make this sort of thing
// @version 2.0.0
// @yessiree

import Modicum from "./modicum.js";
import { makeResizer, makeAnimator } from "./modicumHelpers.js";
import SceneNode from "./scenenode.js";
import Transform from "./transform.js";
const mat3 = glMatrix.mat3;

const PI = Math.PI;
const TWO_PI = PI * 2;

const makeNode = properties =>
  new SceneNode({ transform: new Transform(), ...properties });

const lerp = (p, q, percent) => (1 - percent) * p + percent * q;

// https://oeis.org/A001511
const rulerFunction = t => {
  t++;
  let i = 0;
  while (((t >> i) & 1) == 0) i++;
  return i;
};

// (Does anyone even ask for Penner's permission anymore?!)
const easeInOutQuad = (x, t, b, c, d) => {
  if ((t /= d / 2) < 1) return (c / 2) * t * t + b;
  return (-c / 2) * (--t * (t - 2) - 1) + b;
};

document.body.onload = async () => {
  const modicum = new Modicum();
  document.body.appendChild(modicum.canvas);
  const program = await modicum.loadProgram("shaders/flatshapes.vert");
  const scene = program.makeUniformGroup().setUniforms({
    uColorPalette: [
      [0.07, 0.07, 0.07], // [0.36, 0.53, 0.63],
      [0.35, 0.32, 0.78],
      [0.93, 0.45, 0.07],
      [1.0, 1.0, 1.0]
    ].flat()
  });
  const camera = mat3.create();

  const { resize } = makeResizer(modicum, (width, height) => {
    mat3.identity(camera);
    mat3.scale(camera, camera, [1, -1]);
    mat3.translate(camera, camera, [-1, -1]);
    mat3.scale(camera, camera, [2 / width, 2 / height]);
    scene.setUniforms({ uCamera: camera });

    base.transform.x = width / 2;
    base.transform.y = height / 2;
    base.transform.scaleX = Math.min(width, height);
    base.transform.scaleY = base.transform.scaleX;
  });

  const rings = [];
  const ringContainer = makeNode();

  ringContainer.transform.scaleX = 1 / 20;
  ringContainer.transform.scaleY = 1 / 20;
  const base = makeNode().addChild(ringContainer);
  program.activate();

  const makeRing = size => {
    const innerRadius = (size + 2) * 5;
    const outerRadius = innerRadius + 4;
    const ring = makeNode({ radius: outerRadius });
    const arcAngle = TWO_PI / 3;
    const arcSpan = PI / 3;
    for (let i = 0; i < 3; i++) {
      ring.addChild(
        makeArc(i + 1, innerRadius, outerRadius, arcAngle * i, arcSpan)
      );
      ring.addChild(
        makeArc(
          0,
          innerRadius + 1.5,
          outerRadius - 1.5,
          arcSpan + arcAngle * i,
          arcSpan
        )
      );
    }
    return ring;
  };

  const makeArc = (
    colorIndex,
    innerRadius,
    outerRadius,
    startAngle,
    totalAngle
  ) => {
    const numSegments = Math.floor(
      (innerRadius * 8 * Math.abs(totalAngle)) / TWO_PI
    );
    const numVertices = (numSegments + 1) * 2;
    const numTriangles = numVertices - 2;
    const angleDiff = totalAngle / (numVertices - 2);
    const mesh = program
      .makeMesh(numVertices, numTriangles)
      .setVertex(0, {
        aShape: Array(numSegments + 1)
          .fill()
          .map((_, i) => {
            const angle = startAngle + i * angleDiff * 2;
            const [x, y] = [Math.cos(angle), Math.sin(angle)];
            return [
              x * innerRadius,
              y * innerRadius,
              x * outerRadius,
              y * outerRadius
            ];
          })
          .flat(),
        aColor: Array(numVertices).fill(colorIndex)
      })
      .setIndex(
        0,
        Array(numTriangles)
          .fill()
          .map((_, i) => [i, i + 1, i + 2])
          .flat()
      )
      .setUniforms({ uTransform: mat3.create() });

    return makeNode({ mesh });
  };

  const drawNode = node => {
    node.transform.update(node.parent == null ? null : node.parent.transform);
    node.children.forEach(child => drawNode(child));
    if (node.mesh == null) {
      return;
    }
    program.drawMesh(
      node.mesh.setUniforms({
        uTransform: node.transform.concatenatedMatrix,
        uAlpha: [node.transform.concatenatedAlpha]
      }),
      scene
    );
  };

  let hanoiItr = 0;
  let animTime = 0;
  let ringIndex = 0;

  let currentRing = null;
  let ringStartAngle;
  let ringEndAngle;
  let ringStartAlpha;
  let ringEndAlpha;
  let startScale;
  let endScale;

  const animator = makeAnimator((time, delta) => {
    const speed = Math.pow(1.25, rings.length + 1) / (ringIndex + 1);
    animTime += delta * speed;
    if (animTime >= 1) {
      animTime = 0;
      if (currentRing != null) {
        currentRing.transform.rotation = ringEndAngle % TWO_PI;
        currentRing.transform.alpha = 1;
        ringContainer.transform.scaleY = endScale;
        ringContainer.transform.scaleX = endScale;
      }
      currentRing = null;
    }
    if (currentRing == null) {
      ringIndex = rulerFunction(hanoiItr);
      hanoiItr++;
      if (ringIndex == rings.length) {
        const ring = makeRing(rings.length);
        ringContainer.addChild(ring);
        ring.transform.rotation = PI * (0.25 + ringIndex * 0.05);
        ring.transform.alpha = 0;
        rings.push(ring);
      }

      startScale = ringContainer.transform.scaleX;
      endScale = 0.7 / (2 * rings[rings.length - 1].radius);
      currentRing = rings[ringIndex];
      ringStartAlpha = currentRing.transform.alpha;
      ringEndAlpha = 1;
      ringStartAngle = currentRing.transform.rotation;
      ringEndAngle =
        ringStartAngle + ((ringIndex % 2 == 1 ? 1 : -1) * TWO_PI) / 3;
    }

    const ratio = easeInOutQuad(0, animTime, 0, 1, 1);
    if (currentRing != null) {
      currentRing.transform.rotation = lerp(
        ringStartAngle,
        ringEndAngle,
        ratio
      );
      currentRing.transform.alpha = lerp(ringStartAlpha, ringEndAlpha, ratio);
    }

    if (startScale != endScale) {
      const scale = lerp(startScale, endScale, ratio);
      ringContainer.transform.scaleY = scale;
      ringContainer.transform.scaleX = scale;
    }

    modicum.clear();
    drawNode(base);
  });

  window.onresize = resize;
  resize();
  animator.start();
};
