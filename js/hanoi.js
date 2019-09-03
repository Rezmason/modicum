// Hanoi Rings, by Jeremy Sachs, 2016, yessiree

import Modicum from "./modicum.js";
import SceneNode from "./scenenode.js";
import Transform from "./transform.js";
const mat3 = glMatrix.mat3;

document.body.onload = async () => {
  const PI = Math.PI;
  const TWO_PI = PI * 2;
  let currentRing = null;
  let ringStartAngle;
  let ringEndAngle;
  let ringStartAlpha;
  let ringEndAlpha;
  let startScale;
  let endScale;

  let lastTime;

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const modicum = new Modicum(canvas);
  const program = await modicum.makeProgram(
    "shaders/simple.vert",
    "shaders/simple.frag"
  );

  const scene = modicum.makeUniformGroup(program);
  const camera = mat3.create();
  scene.setUniforms({
    uColorPalette:[
      0.07, 0.07, 0.07,
      // 0.36, 0.53, 0.63,
      0.35, 0.32, 0.78,
      0.93, 0.45, 0.07,
      1.00, 1.00, 1.00,
    ]
  });

  const rings = [];
  const ringContainer = new SceneNode();
  ringContainer.transform = new Transform();
  ringContainer.transform.scaleX = 0;
  ringContainer.transform.scaleY = 0;
  const base = new SceneNode();
  base.transform = new Transform();
  base.addChild(ringContainer);

  let hanoiItr = 0;
  let animTime = 0;
  let ringIndex = 0;

  const resize = () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    mat3.identity(camera);
    mat3.scale(camera, camera, [1, -1]);
    mat3.translate(camera, camera, [-1, -1]);
    mat3.scale(camera, camera, [2 / canvas.width, 2 / canvas.height]);
    scene.setUniforms({ uCamera: camera });

    base.transform.x = canvas.width / 2;
    base.transform.y = canvas.height / 2;
    base.transform.scaleX = Math.min(canvas.width, canvas.height);
    base.transform.scaleY = base.transform.scaleX;

    modicum.resize();
  };

  // It's the ruler function: https://oeis.org/A001511
  const getRingIndex = t => {
    t++;
    let i = 0;
    while (((t >> i) & 1) == 0) i++;
    return i;
  };

  const animate = time => {
    const delta = (lastTime != null ? time - lastTime : 0) / 1000;
    lastTime = time;
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
      ringIndex = getRingIndex(hanoiItr);
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
      currentRing.transform.rotation =
        (1 - ratio) * ringStartAngle + ratio * ringEndAngle;
      currentRing.transform.alpha =
        (1 - ratio) * ringStartAlpha + ratio * ringEndAlpha;
    }

    if (startScale != endScale) {
      const scale = (1 - ratio) * startScale + ratio * endScale;
      ringContainer.transform.scaleY = scale;
      ringContainer.transform.scaleX = scale;
    }

    modicum.clear();
    drawNode(base);

    window.requestAnimationFrame(animate);
  };

  const makeRing = size => {
    const innerRadius = (size + 2) * 5;
    const outerRadius = innerRadius + 4;
    const ring = new SceneNode();
    ring.transform = new Transform();
    ring.radius = outerRadius;
    const arcSpan = PI / 3;
    for (let i = 0; i < 3; i++) {
      const arcStartAngle = (TWO_PI / 3) * i;
      ring.addChild(
        makeArc(i + 1, innerRadius, outerRadius, arcStartAngle, arcSpan)
      );
      ring.addChild(
        makeArc(
          0,
          innerRadius + 1.5,
          outerRadius - 1.5,
          arcSpan + arcStartAngle,
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
    const positions = [];
    const numSegments = Math.floor(
      (innerRadius * 8 * Math.abs(totalAngle)) / TWO_PI
    );
    const numVertices = (numSegments + 1) * 2;
    const angleDiff = totalAngle / (numVertices - 2);
    for (let i = 0; i < numVertices; i += 2) {
      const angle = startAngle + i * angleDiff;
      positions.push(
        Math.cos(angle) * innerRadius,
        Math.sin(angle) * innerRadius
      );
      positions.push(
        Math.cos(angle) * outerRadius,
        Math.sin(angle) * outerRadius
      );
    }

    const colors = Array(numVertices).fill(colorIndex);
    const numTriangles = numVertices - 2;
    const indices = Array(numTriangles)
      .fill()
      .map((_, i) => [i, i + 1, i + 2])
      .flat();

    const mesh = modicum.makeMesh(program, numVertices, numTriangles);
    mesh.setVertex(0, { aShape: positions, aColor: colors });
    mesh.setIndex(0, indices);
    const transform = mat3.create();
    mesh.setUniforms({ uTransform: transform });

    const node = new SceneNode();
    node.transform = new Transform();
    node.mesh = mesh;

    return node;
  };

  const drawNode = node => {
    node.transform.update();
    if (node.parent == null) node.transform.resetConcat();
    else node.transform.updateConcat(node.parent.transform);
    for (let i = node.children.length - 1; i >= 0; i--)
      drawNode(node.children[i]);
    if (node.mesh != null) {
      const matrix =
        node.parent == null
          ? node.transform.matrix
          : node.transform.concatenatedMatrix;
      const alpha =
        node.parent == null
          ? node.transform.alpha
          : node.transform.concatenatedAlpha;
      node.mesh.setUniforms({ uTransform: matrix, uAlpha: [alpha] });
      modicum.drawMesh(program, node.mesh, scene);
    }
  };

  // (Does anyone even ask for Penner's permission anymore?!)
  const easeInOutQuad = (x, t, b, c, d) => {
    if ((t /= d / 2) < 1) return (c / 2) * t * t + b;
    return (-c / 2) * (--t * (t - 2) - 1) + b;
  };

  program.activate();
  resize();
  window.onresize = resize;
  animate(0);
};
