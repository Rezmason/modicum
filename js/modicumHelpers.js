import Modicum from "./modicum.js";

const makeResizer = (modicum, func, target = null, resolution = 1.0) => {
  if (target == null) {
    target = modicum.canvas;
  }

  const resizer = {
    resolution,
    resize: () => {
      modicum.canvas.width = target.clientWidth * resizer.resolution;
      modicum.canvas.height = target.clientHeight * resizer.resolution;
      modicum.resize(modicum.canvas.width, modicum.canvas.height);
      func(modicum.width, modicum.height);
    }
  };

  return resizer;
};

const makeAnimator = func => {
  let active = false;
  let lastTime = 0;
  const animate = time => {
    const delta = time - lastTime;
    lastTime = time;
    if (active) {
      func(time * 0.001, delta * 0.001);
      window.requestAnimationFrame(animate);
    }
  };
  return {
    start: () => {
      active = true;
      animate(0);
    },
    stop: () => (active = false)
  };
};

const setDepthTest = (modicum, enabled) => {
  modicum.tweak(gl =>
    enabled ? gl.enable(gl.DEPTH_TEST) : gl.disable(gl.DEPTH_TEST)
  );
};

const setCulling = (modicum, front, back) => {
  modicum.tweak(gl => {
    gl.enable(gl.CULL_FACE);
    gl.cullFace(front && back ? gl.FRONT_AND_BACK : front ? gl.FRONT : gl.BACK);
  });
};

const setStandardBlending = modicum => {
  modicum.tweak(gl => {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ZERO);
  });
};

const setAlphaBlending = modicum => {
  modicum.tweak(gl => {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  });
};

const setAdditiveBlending = modicum => {
  modicum.tweak(gl => {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.DST_ALPHA);
  });
};

const parseVec = s =>
  s
    .split(" ")
    .slice(1)
    .map(s => parseFloat(s));

const getVec = (lines, prefix) =>
  lines.filter(line => line.startsWith(`${prefix} `)).map(parseVec);

const parseFace = s => {
  const ids = s.split(" ").slice(1);
  return Array(ids.length - 2)
    .fill()
    .map((_, i) => [ids[0], ids[i + 1], ids[i + 2]])
    .flat();
};

const loadOBJ = async url => {
  const lines = (await fetch(url).then(response => response.text())).split(
    "\n"
  );
  const positionRecords = getVec(lines, "v");
  const uvRecords = getVec(lines, "vt");
  const normalRecords = getVec(lines, "vn");
  const vertexIDs = lines
    .filter(line => line.startsWith("f "))
    .map(parseFace)
    .flat();
  const uniqueVertexIDs = Array.from(new Set(vertexIDs));
  const vertices = uniqueVertexIDs.map((id, index) => {
    const [positionIndex, uvIndex, normalIndex] = id
      .split("/")
      .map(id => parseInt(id) - 1);
    return {
      id,
      index,
      position: positionRecords[positionIndex],
      uv: uvRecords[uvIndex],
      normal: normalRecords[normalIndex]
    };
  });
  const indicesByVertexID = new Map(
    vertices.map(vertex => [vertex.id, vertex.index])
  );

  return {
    numVertices: uniqueVertexIDs.length,
    numTriangles: vertexIDs.length / 3,
    positions: vertices.map(({ position }) => position).flat(),
    uvs: vertices.map(({ uv }) => uv).flat(),
    normals: vertices.map(({ normal }) => normal).flat(),
    indices: vertexIDs.map(vertexID => indicesByVertexID.get(vertexID))
  };
};

const ogles3Prefix = "#version 300 es";
const attributeDeclaration = /attribute/g;
const varyingDeclaration = /varying/g;
const textureCall = /texture *(2D|Cube)\(/g;
const fragColorInjectSite = /^(precision.*)$/m;
const fragColorCall = /gl_FragColor/g;

const upgradeShaderSource = (modicum, vertSource, fragSource) => {
  if (modicum.version === 2) {
    if (!vertSource.startsWith(ogles3Prefix)) {
      vertSource = `${ogles3Prefix}
        ${vertSource
          .replace(attributeDeclaration, "in")
          .replace(varyingDeclaration, "out")
          .replace(textureCall, "texture(")}`;
    }

    if (!fragSource.startsWith(ogles3Prefix)) {
      fragSource = `${ogles3Prefix}
        ${fragSource
          .replace(varyingDeclaration, "in")
          .replace(fragColorInjectSite, "$1\nout vec4 modicum_FragColor;")
          .replace(textureCall, "texture(")
          .replace(fragColorCall, "modicum_FragColor")}`;
    }
  }

  return [vertSource, fragSource];
};

export {
  makeResizer,
  makeAnimator,
  setDepthTest,
  setCulling,
  setStandardBlending,
  setAlphaBlending,
  setAdditiveBlending,
  loadOBJ,
  upgradeShaderSource
};
