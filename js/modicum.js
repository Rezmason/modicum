// @fileoverview modicum - A simplistic API for small scale WebGL projects
// @author Jeremy Sachs
// @version 2.0.0

const createFormat = (gl, formatName) => {
  const isFloat = formatName.endsWith("fv");
  const isMat = formatName.includes("Matrix");
  const count = parseInt(formatName.charAt(formatName.length - 3));
  const typeName =
    (isFloat ? "FLOAT" : "INT") +
    (count == 1 ? "" : `_${isMat ? "MAT" : "VEC"}${count.toString()}`);
  const type = gl[typeName];
  const stride = isMat ? count ** 2 : count;
  return [
    type,
    {
      pointerType: isFloat ? gl.FLOAT : gl.INT,
      stride,
      create: isFloat
        ? ({ size }) => new Float32Array(size * stride)
        : ({ size }) => new Int32Array(size * stride),
      assign: isMat
        ? (l, v) => gl[formatName](l, false, v)
        : (l, v) => gl[formatName](l, v)
    }
  ];
};

const uniformFormatNames = [
  "uniform1fv",
  "uniform2fv",
  "uniform3fv",
  "uniform4fv",
  "uniform1iv",
  "uniform2iv",
  "uniform3iv",
  "uniform4iv",
  "uniformMatrix2fv",
  "uniformMatrix3fv",
  "uniformMatrix4fv"
];

const defaultParams = {
  premultipliedAlpha: false,
  antialias: true,
  alpha: false
};

const bindToTarget = (gl, target) => {
  const { width, height, nativeFrameBuf } = target;
  gl.bindFramebuffer(gl.FRAMEBUFFER, nativeFrameBuf);
  gl.viewport(0, 0, width, height);
};

class Modicum {
  constructor(canvas, params = {}) {
    if (canvas == null) {
      canvas = document.createElement("canvas");
    }
    this.canvas = canvas;
    const combinedParams = { ...defaultParams, ...params };
    const contextCandidates =
      params.api === "v2"
        ? ["webgl2"]
        : params.api === "v2Fallback"
        ? ["webgl2", "webgl"]
        : ["webgl"];
    this.gl = contextCandidates.reduce(
      (gl, candidate) =>
        gl != null ? gl : canvas.getContext(candidate, combinedParams),
      null
    );
    if (this.gl == null) {
      console.warn("Modicum is not supported in this browser.");
      return;
    }
    if (params.debugger != null) {
      console.log("Modicum is running through your debugger.");
      this.gl = params.debugger(this.gl);
    }
    const gl = this.gl;
    this.defaultTarget = {};

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.resize();
    this.clear();

    this.formats = Object.fromEntries(
      uniformFormatNames.map(formatName => createFormat(gl, formatName))
    );
  }

  tweak(f) {
    f(this.gl);
    return this;
  }

  resize(width, height) {
    if (width == null) width = this.gl.drawingBufferWidth;
    if (height == null) height = this.gl.drawingBufferHeight;
    this.width = width;
    this.height = height;
    this.defaultTarget.width = width;
    this.defaultTarget.height = height;
    return this;
  }

  clear(color, clearDepth = false, target = null) {
    if (color != null) this.gl.clearColor(color.r, color.g, color.b, color.a);
    else this.gl.clearColor(0, 0, 0, 1);
    bindToTarget(this.gl, target == null ? this.defaultTarget : target);
    this.gl.clear(
      this.gl.COLOR_BUFFER_BIT | (clearDepth ? this.gl.DEPTH_BUFFER_BIT : 0)
    );
    return this;
  }

  makeProgram(vertSource = null, fragSource = null) {
    return new Program(
      this.gl,
      this.formats,
      this.defaultTarget,
      vertSource,
      fragSource
    );
  }

  async loadProgram(vertURL = null, fragURL = null) {
    const [vertSource, fragSource] = await Promise.all([
      vertURL == null
        ? Promise.resolve()
        : fetch(vertURL).then(response => response.text()),
      fragURL == null
        ? Promise.resolve()
        : fetch(fragURL).then(response => response.text())
    ]);
    return new Program(
      this.gl,
      this.formats,
      this.defaultTarget,
      vertSource,
      fragSource
    );
  }

  async makeTexture(width, height, data, params = null) {
    await this.installTextures();
    return new this.textures.Texture(this.gl, width, height, data, params);
  }

  async loadImageTexture(imageURL, params = null) {
    await this.installTextures();
    return await this.textures.loadImageTexture(this.gl, imageURL, params);
  }

  async makeTarget(width, height, params = null) {
    await this.installTextures();
    return new this.textures.Target(this.gl, width, height, params);
  }

  async installTextures() {
    if (this.textures == null) {
      this.textures = await import("./modicumTextures.js");
      Object.assign(this.formats, this.textures.createSamplerFormats(this));
    }
  }
}

const processShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw gl.getShaderInfoLog(shader);
    return null;
  }
  return shader;
};

const simpleVertSource = `
attribute vec3 aPos;
attribute vec3 aColor;
uniform mat3 uTransform;
uniform mat3 uCamera;
varying vec3 vColor;
void main(void) {
  vColor = vec4(aColor, 1.0);
  gl_Position = vec4(uCamera * uTransform * aPos, 1.0);
}
`;

const simpleFragSource = `
precision mediump float;
varying vec4 vColor;
void main(void) {
  gl_FragColor = vColor;
}
`;

class Program {
  constructor(gl, formats, defaultTarget, vertSource, fragSource) {
    this.gl = gl;
    this.formats = formats;
    this.defaultTarget = defaultTarget;

    if (vertSource == null) {
      vertSource = simpleVertSource;
    }

    if (fragSource == null) {
      fragSource = simpleFragSource;
    }

    this.vertSource = vertSource;
    this.fragSource = fragSource;

    const nativeProg = gl.createProgram();
    this.nativeProg = nativeProg;
    this.vertShader = processShader(gl, gl.VERTEX_SHADER, vertSource);
    this.fragShader = processShader(gl, gl.FRAGMENT_SHADER, fragSource);
    gl.attachShader(nativeProg, this.vertShader);
    gl.attachShader(nativeProg, this.fragShader);
    gl.linkProgram(nativeProg);

    if (!gl.getProgramParameter(nativeProg, gl.LINK_STATUS)) {
      throw new Error("Could not initialise shaders");
    }

    this.uniformData = {};
    const numActiveUniforms = gl.getProgramParameter(
      nativeProg,
      gl.ACTIVE_UNIFORMS
    );
    for (let ike = 0; ike < numActiveUniforms; ike++) {
      const uniform = gl.getActiveUniform(nativeProg, ike);
      const name = uniform.name.split("[")[0];
      const location = gl.getUniformLocation(nativeProg, uniform.name);
      this.uniformData[name] = {
        size: uniform.size,
        location,
        format: formats[uniform.type]
      };
    }

    this.attributeData = {};
    const numActiveAttributes = gl.getProgramParameter(
      nativeProg,
      gl.ACTIVE_ATTRIBUTES
    );
    for (let ike = 0; ike < numActiveAttributes; ike++) {
      const attribute = gl.getActiveAttrib(nativeProg, ike);
      if (!(attribute.type in formats)) {
        throw new Error(`Unsupported attribute type: ${attribute.type}`);
      }
      const name = attribute.name.split("[")[0];
      this.attributeData[name] = {
        index: ike,
        format: formats[attribute.type]
      };
    }

    this.textureIndexer = { currentIndex: 0 };
  }

  destroy() {
    if (this.gl == null) {
      return;
    }
    this.deactivate();
    this.gl.deleteProgram(this.nativeProg);
    this.gl.deleteShader(this.vertShader);
    this.gl.deleteShader(this.fragShader);
    this.nativeProg = null;
    this.vertShader = null;
    this.fragShader = null;
    this.defaultTarget = null;
    this.gl = null;
  }

  activate(target = null) {
    this.gl.useProgram(this.nativeProg);
    bindToTarget(this.gl, target == null ? this.defaultTarget : target);
    for (const prop in this.attributeData)
      this.gl.enableVertexAttribArray(this.attributeData[prop].index);
    return this;
  }

  deactivate() {
    this.gl.useProgram(null);
    for (const prop in this.attributeData)
      this.gl.disableVertexAttribArray(this.attributeData[prop].index);
    return this;
  }

  makeMesh(numVertices, numTriangles) {
    return new Mesh(this.gl, this, numVertices, numTriangles);
  }

  makeUniformGroup(values = {}) {
    return new UniformGroup(this.gl, this).setUniforms(values);
  }

  drawMesh(mesh, uniformGroups = null) {
    mesh.update();

    if (uniformGroups != null) {
      if (Array.isArray(uniformGroups)) {
        uniformGroups = [mesh.uniformGroup, ...uniformGroups];
      } else {
        uniformGroups = [mesh.uniformGroup, uniformGroups];
      }
    } else {
      uniformGroups = [mesh.uniformGroup];
    }

    this.textureIndexer.currentIndex = 0;
    Object.entries(this.uniformData).forEach(([propName, datum]) => {
      const group = uniformGroups.find(
        ({ uniformsUsed }) => uniformsUsed[propName]
      );
      if (group == null) {
        console.warn(`Uniform ${propName} has no value.`);
      } else {
        datum.format.assign(datum.location, group.uniforms[propName], this);
      }
    });

    const gl = this.gl;

    Object.entries(this.attributeData).forEach(([propName, datum]) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffers[propName].nativeBuf);
      const { stride, pointerType } = datum.format;
      gl.vertexAttribPointer(datum.index, stride, pointerType, false, 0, 0);
    });

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer.nativeBuf);
    gl.drawElements(gl.TRIANGLES, mesh.numIndices, gl.UNSIGNED_SHORT, 0);
    return this;
  }
}

class Mesh {
  constructor(gl, program, numVertices, numTriangles) {
    this.gl = gl;
    this.numVertices = numVertices;
    this.numTriangles = numTriangles;
    this.numIndices = numTriangles * 3;
    this.uniformGroup = program.makeUniformGroup();
    this.vertexBuffers = {};
    for (const prop in program.attributeData) {
      this.vertexBuffers[prop] = new VertexBuffer(
        gl,
        program.attributeData[prop].format,
        numVertices
      );
    }
    this.indexBuffer = new IndexBuffer(gl, this.numIndices);
  }

  destroy() {
    if (this.gl == null) {
      return;
    }
    this.uniformGroup.destroy();
    for (const prop in values) this.gl.destroyBuffer(this.vertexBuffers[prop]);
    this.indexBuffer.destroy();
  }

  setVertex(index, values) {
    for (const prop in values)
      this.vertexBuffers[prop].setVertex(index, values[prop]);
    return this;
  }

  setIndex(index, values) {
    this.indexBuffer.setIndex(index, values);
    return this;
  }

  setUniforms(values) {
    this.uniformGroup.setUniforms(values);
    return this;
  }

  update() {
    this.indexBuffer.update();
    for (const prop in this.vertexBuffers) this.vertexBuffers[prop].update();
    return this;
  }
}

class UniformGroup {
  constructor(gl, program) {
    this.gl = gl;
    this.uniforms = {};
    this.uniformsUsed = {};
    for (const prop in program.uniformData) {
      const uniformDatum = program.uniformData[prop];
      this.uniforms[prop] = uniformDatum.format.create(uniformDatum);
    }
  }

  destroy() {
    if (this.gl == null) {
      return;
    }
    this.gl = null;
  }

  setUniforms(values) {
    for (const prop in values) {
      this.uniformsUsed[prop] = true;
      if (this.uniforms[prop] == null) {
        throw new Error(`No uniform named ${prop}.`);
      }
      this.uniforms[prop].set(values[prop]);
    }
    return this;
  }
}

class IndexBuffer {
  constructor(gl, numIndices) {
    this.gl = gl;
    this.nativeBuf = this.gl.createBuffer();
    this.indices = new Uint16Array(numIndices);
    this.dirty = true;
  }

  destroy() {
    if (this.gl == null) {
      return;
    }
    this.gl.deleteBuffer(this.nativeBuf);
    this.nativeBuf = null;
    this.indices = null;
    this.gl = null;
  }

  setIndex(index, values) {
    this.indices.set(values, index);
    this.dirty = true;
    return this;
  }

  setTriangle(triangleIndex, values) {
    return this.setIndex(triangleIndex * 3, values);
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      const gl = this.gl;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.nativeBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
    }
    return this;
  }
}

class VertexBuffer {
  constructor(gl, format, numVertices) {
    this.gl = gl;
    this.numVertices = numVertices;
    this.stride = format.stride;
    this.nativeBuf = this.gl.createBuffer();
    this.vertices = format.create({ size: numVertices });
    this.dirty = true;
  }

  destroy() {
    if (this.gl == null) {
      return;
    }
    this.gl.deleteBuffer(this.nativeBuf);
    this.nativeBuf = null;
    this.vertices = null;
    this.gl = null;
  }

  setVertex(index, values) {
    this.vertices.set(values, index * this.stride);
    this.dirty = true;
    return this;
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.nativeBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
    }
    return this;
  }
}

export default Modicum;
