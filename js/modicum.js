// @fileoverview modicum - A simplistic API for small scale WebGL projects
// @author Jeremy Sachs
// @version 2.0.0

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

    const flattenMatFunc = func => (loc, mat) => func(loc, false, mat);
    const floatTypes = { type: gl.FLOAT, bType: Float32Array };
    const intTypes = { type: gl.FLOAT, bType: Int32Array };

    this.formats = {
      [gl.FLOAT     ]: { ...floatTypes, stride: 1, assign: gl.uniform1fv.bind(gl)},
      [gl.FLOAT_VEC2]: { ...floatTypes, stride: 2, assign: gl.uniform2fv.bind(gl)},
      [gl.FLOAT_VEC3]: { ...floatTypes, stride: 3, assign: gl.uniform3fv.bind(gl)},
      [gl.FLOAT_VEC4]: { ...floatTypes, stride: 4, assign: gl.uniform4fv.bind(gl)},

      [gl.INT     ]: { ...intTypes, stride: 1, assign: gl.uniform1iv.bind(gl)},
      [gl.INT_VEC2]: { ...intTypes, stride: 2, assign: gl.uniform2iv.bind(gl)},
      [gl.INT_VEC3]: { ...intTypes, stride: 3, assign: gl.uniform3iv.bind(gl)},
      [gl.INT_VEC4]: { ...intTypes, stride: 4, assign: gl.uniform4iv.bind(gl)},

      [gl.FLOAT_MAT2]: { ...floatTypes, stride: 2 ** 2, assign: flattenMatFunc(gl.uniformMatrix2fv.bind(gl))},
      [gl.FLOAT_MAT3]: { ...floatTypes, stride: 3 ** 2, assign: flattenMatFunc(gl.uniformMatrix3fv.bind(gl))},
      [gl.FLOAT_MAT4]: { ...floatTypes, stride: 4 ** 2, assign: flattenMatFunc(gl.uniformMatrix4fv.bind(gl))},
    };
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

  drawMesh(program, mesh, other) {
    mesh.update();

    if (other == null) other = mesh.uniformGroup;
    Object.entries(program.uniformData).forEach(([propName, datum]) =>
      datum.format.assign(
        datum.location,
        (propName in mesh.uniformGroup.uniformsUsed ? mesh.uniformGroup : other)
          .uniforms[propName]
      )
    );

    Object.entries(program.attributeData).forEach(([propName, datum]) => {
      this.gl.bindBuffer(
        this.gl.ARRAY_BUFFER,
        mesh.vertexBuffers[propName].buffer
      );
      const { stride, type } = datum.format;
      this.gl.vertexAttribPointer(datum.index, stride, type, false, 0, 0);
    });

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer.buffer);
    this.gl.drawElements(
      this.gl.TRIANGLES,
      mesh.numIndices,
      this.gl.UNSIGNED_SHORT,
      0
    );
  }

  async makeProgram(vertURL, fragURL) {
    const [vertSource, fragSource] = await Promise.all([
      fetch(vertURL).then(response => response.text()),
      fetch(fragURL).then(response => response.text())
    ]);
    return new Program(this, vertURL, fragURL, vertSource, fragSource);
  }

  makeMesh(program, numVertices, numTriangles) {
    return new Mesh(this, program, numVertices, numTriangles);
  }

  makeUniformGroup(program) {
    return new UniformGroup(this, program);
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
    for (let prop in this.attributeData)
      this.modicum.gl.enableVertexAttribArray(this.attributeData[prop].index);
  }

  deactivate() {
    this.modicum.gl.useProgram(null);
    for (let prop in this.attributeData)
      this.modicum.gl.disableVertexAttribArray(this.attributeData[prop].index);
  }
}

class Mesh {
  constructor(modicum, program, numVertices, numTriangles) {
    this.modicum = modicum;
    this.numVertices = numVertices;
    this.numTriangles = numTriangles;
    this.numIndices = numTriangles * 3;
    this.uniformGroup = this.modicum.makeUniformGroup(program);
    this.vertexBuffers = {};
    for (let prop in program.attributeData) {
      this.vertexBuffers[prop] = this.modicum.makeVertexBuffer(
        program.attributeData[prop].format,
        numVertices
      );
    }
    this.indexBuffer = this.modicum.makeIndexBuffer(this.numIndices);
    this.setIndex = this.indexBuffer.setIndex.bind(this.indexBuffer);
    this.setUniforms = this.uniformGroup.setUniforms.bind(this.uniformGroup);
  }

  setVertex(index, values) {
    for (let prop in values)
      this.vertexBuffers[prop].setVertex(index, values[prop]);
  }

  update() {
    this.indexBuffer.update();
    for (let prop in this.vertexBuffers) this.vertexBuffers[prop].update();
  }
}

class UniformGroup {
  constructor(modicum, program) {
    this.modicum = modicum;
    this.uniforms = {};
    this.uniformsUsed = {};
    for (let prop in program.uniformData) {
      const uniformDatum = program.uniformData[prop];
      const format = uniformDatum.format;
      this.uniforms[prop] = new format.bType(uniformDatum.size * format.stride);
    }
  }

  setUniforms(values) {
    for (let prop in values) {
      this.uniformsUsed[prop] = true;
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
