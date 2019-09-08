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
  const pointerType = isFloat ? gl.FLOAT : gl.INT;
  const bType = isFloat ? Float32Array : Int32Array;
  const stride = isMat ? count ** 2 : count;
  const assign = isMat
    ? (l, v) => gl[formatName](l, false, v)
    : (l, v) => gl[formatName](l, v);
  return [
    type,
    {
      pointerType,
      bType,
      stride,
      assign
    }
  ];
};

const uniformFormats = [
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

class Modicum {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      premultipliedAlpha: false,
      alpha: false
    });
    const gl = this.gl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.resize();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.colorMask(true, true, true, false);

    this.formats = Object.fromEntries(
      uniformFormats.map(formatName => createFormat(gl, formatName))
    );
  }

  tweak(f) {
    f(this.gl);
  }

  resize(width, height) {
    if (width == null) width = this.gl.drawingBufferWidth;
    if (height == null) height = this.gl.drawingBufferHeight;
    this.width = width;
    this.height = height;
    this.gl.viewport(0, 0, this.width, this.height);
  }

  clear(color) {
    if (color != null) this.gl.clearColor(color.r, color.g, color.b, color.a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT /* | this.gl.DEPTH_BUFFER_BIT*/);
  }

  async makeProgram(vertURL, fragURL) {
    const [vertSource, fragSource] = await Promise.all([
      fetch(vertURL).then(response => response.text()),
      fetch(fragURL).then(response => response.text())
    ]);
    return new Program(this, vertURL, fragURL, vertSource, fragSource);
  }

  makeIndexBuffer(numIndices) {
    return new IndexBuffer(this, numIndices);
  }

  makeVertexBuffer(format, numVertices) {
    return new VertexBuffer(this, format, numVertices);
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

class Program {
  constructor(modicum, vertURL, fragURL, vertSource, fragSource) {
    this.modicum = modicum;
    this.vertURL = vertURL;
    this.fragURL = fragURL;
    this.vertSource = vertSource;
    this.fragSource = fragSource;

    const gl = this.modicum.gl;
    const formats = this.modicum.formats;

    const nativeProg = gl.createProgram();
    this.nativeProg = nativeProg;
    gl.attachShader(
      nativeProg,
      processShader(gl, gl.VERTEX_SHADER, vertSource)
    );
    gl.attachShader(
      nativeProg,
      processShader(gl, gl.FRAGMENT_SHADER, fragSource)
    );
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
  }

  activate() {
    this.modicum.gl.useProgram(this.nativeProg);
    for (const prop in this.attributeData)
      this.modicum.gl.enableVertexAttribArray(this.attributeData[prop].index);
  }

  deactivate() {
    this.modicum.gl.useProgram(null);
    for (const prop in this.attributeData)
      this.modicum.gl.disableVertexAttribArray(this.attributeData[prop].index);
  }

  makeMesh(numVertices, numTriangles) {
    return new Mesh(this.modicum, this, numVertices, numTriangles);
  }

  makeUniformGroup() {
    return new UniformGroup(this.modicum, this);
  }

  drawMesh(mesh, other) {
    mesh.update();

    if (other == null) other = mesh.uniformGroup;
    Object.entries(this.uniformData).forEach(([propName, datum]) =>
      datum.format.assign(
        datum.location,
        (propName in mesh.uniformGroup.uniformsUsed ? mesh.uniformGroup : other)
          .uniforms[propName]
      )
    );

    const gl = this.modicum.gl;

    Object.entries(this.attributeData).forEach(([propName, datum]) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffers[propName].buffer);
      const { stride, pointerType } = datum.format;
      gl.vertexAttribPointer(datum.index, stride, pointerType, false, 0, 0);
    });

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer.buffer);
    gl.drawElements(gl.TRIANGLES, mesh.numIndices, gl.UNSIGNED_SHORT, 0);
  }
}

class Mesh {
  constructor(modicum, program, numVertices, numTriangles) {
    this.modicum = modicum;
    this.numVertices = numVertices;
    this.numTriangles = numTriangles;
    this.numIndices = numTriangles * 3;
    this.uniformGroup = program.makeUniformGroup();
    this.vertexBuffers = {};
    for (const prop in program.attributeData) {
      this.vertexBuffers[prop] = this.modicum.makeVertexBuffer(
        program.attributeData[prop].format,
        numVertices
      );
    }
    this.indexBuffer = this.modicum.makeIndexBuffer(this.numIndices);
  }

  setVertex(index, values) {
    for (const prop in values)
      this.vertexBuffers[prop].setVertex(index, values[prop]);
  }

  setIndex(index, values) {
    this.indexBuffer.setIndex(index, values);
  }

  setUniforms(values) {
    this.uniformGroup.setUniforms(values);
  }

  update() {
    this.indexBuffer.update();
    for (const prop in this.vertexBuffers) this.vertexBuffers[prop].update();
  }
}

class UniformGroup {
  constructor(modicum, program) {
    this.modicum = modicum;
    this.uniforms = {};
    this.uniformsUsed = {};
    for (const prop in program.uniformData) {
      const uniformDatum = program.uniformData[prop];
      const format = uniformDatum.format;
      this.uniforms[prop] = new format.bType(uniformDatum.size * format.stride);
    }
  }

  setUniforms(values) {
    for (const prop in values) {
      this.uniformsUsed[prop] = true;
      if (this.uniforms[prop] == null) {
        throw new Error(`No uniform named ${prop}.`);
      }
      this.uniforms[prop].set(values[prop]);
    }
  }
}

class IndexBuffer {
  constructor(modicum, numIndices) {
    this.modicum = modicum;
    this.buffer = this.modicum.gl.createBuffer();
    this.indices = new Uint16Array(numIndices);
    this.dirty = true;
  }

  setIndex(index, values) {
    this.indices.set(values, index);
    this.dirty = true;
  }

  setTriangle(triangleIndex, values) {
    this.setIndex(triangleIndex * 3, values);
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      const gl = this.modicum.gl;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
    }
  }
}

class VertexBuffer {
  constructor(modicum, format, numVertices) {
    this.modicum = modicum;
    this.numVertices = numVertices;
    this.stride = format.stride;
    this.buffer = this.modicum.gl.createBuffer();
    this.vertices = new format.bType(numVertices * format.stride);
    this.dirty = true;
  }

  setVertex(index, values) {
    this.vertices.set(values, index * this.stride);
    this.dirty = true;
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      const gl = this.modicum.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
    }
  }
}

export default Modicum;
