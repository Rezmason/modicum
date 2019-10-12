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

const createSamplerFormat = (gl, formatName) => {
  const typeName = `SAMPLER_${formatName
    .split("sampler")
    .pop()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toUpperCase()}`;
  const type = gl[typeName];
  return [
    type,
    {
      create: data => {
        let texture = null;
        return {
          get: () => texture,
          set: v => (texture = v)
        };
      },
      assign: (l, v, { textureIndexer }) => {
        const texture = v.get();
        const index = textureIndexer.currentIndex++;
        gl.uniform1i(l, index);
        gl.activeTexture(gl.TEXTURE0 + index);
        if (texture == null) {
          gl.bindTexture(gl.TEXTURE_2D, null);
        } else {
          texture.update();
        }
      }
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

const samplerFormats = ["sampler2D"];

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

    this.formats = {
      ...Object.fromEntries(
        uniformFormats.map(formatName => createFormat(gl, formatName))
      ),
      ...Object.fromEntries(
        samplerFormats.map(formatName => createSamplerFormat(gl, formatName))
      )
    };
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

  clear(color, clearDepth = false) {
    if (color != null) this.gl.clearColor(color.r, color.g, color.b, color.a);
    this.gl.clear(
      this.gl.COLOR_BUFFER_BIT | (clearDepth ? this.gl.DEPTH_BUFFER_BIT : 0)
    );
  }

  makeProgram(vertSource = null, fragSource = null) {
    return new Program(this, vertSource, fragSource);
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
    return new Program(this, vertSource, fragSource);
  }

  makeTexture(width, height, data, isFloat = false, numChannels = 4) {
    return new Texture(this, width, height, data, isFloat, numChannels);
  }

  async loadImageTexture(imageURL, isFloat = false, numChannels = 4) {
    const image = new Image();
    image.src = imageURL;
    await image.decode();
    // createImageBitmap is not in Safari yet...
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = [image.width, image.height];
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const rawData = Array.from(
      ctx.getImageData(0, 0, image.width, image.height).data
    )
      .map((value, index) => (index % 4 < numChannels ? value : null))
      .filter(value => value != null);
    const data = isFloat ? rawData.map(i => i / 0xff) : rawData;
    return new Texture(
      this,
      image.width,
      image.height,
      data,
      isFloat,
      numChannels
    );
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
  constructor(modicum, vertSource, fragSource) {
    this.modicum = modicum;

    if (vertSource == null) {
      vertSource = simpleVertSource;
    }

    if (fragSource == null) {
      fragSource = simpleFragSource;
    }

    this.vertSource = vertSource;
    this.fragSource = fragSource;

    const gl = this.modicum.gl;
    const formats = this.modicum.formats;

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
    if (this.modicum == null) {
      return;
    }
    this.deactivate();
    this.modicum.gl.deleteProgram(this.nativeProg);
    this.modicum.gl.deleteShader(this.vertShader);
    this.modicum.gl.deleteShader(this.fragShader);
    this.nativeProg = null;
    this.vertShader = null;
    this.fragShader = null;
    this.modicum = null;
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
    this.textureIndexer.currentIndex = 0;
    Object.entries(this.uniformData).forEach(([propName, datum]) =>
      datum.format.assign(
        datum.location,
        (propName in mesh.uniformGroup.uniformsUsed ? mesh.uniformGroup : other)
          .uniforms[propName],
        this
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

  destroy() {
    if (this.modicum == null) {
      return;
    }
    this.uniformGroup.destroy();
    for (const prop in values)
      this.modicum.gl.destroyBuffer(this.vertexBuffers[prop]);
    this.indexBuffer.destroy();
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
      this.uniforms[prop] = uniformDatum.format.create(uniformDatum);
    }
  }

  destroy() {
    if (this.modicum == null) {
      return;
    }
    this.modicum = null;
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

  destroy() {
    if (this.modicum == null) {
      return;
    }
    this.modicum.gl.deleteBuffer(this.buffer);
    this.buffer = null;
    this.indices = null;
    this.modicum = null;
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
    this.vertices = format.create({ size: numVertices });
    this.dirty = true;
  }

  destroy() {
    if (this.modicum == null) {
      return;
    }
    this.modicum.gl.deleteBuffer(this.buffer);
    this.buffer = null;
    this.vertices = null;
    this.modicum = null;
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

const textureFormatsByChannelCount = [
  ["RED", "LUMINANCE"],
  ["RG", "LUMINANCE_ALPHA"],
  ["RGB"],
  ["RGBA"]
];

class Texture {
  constructor(modicum, width, height, data, isFloat, numChannels) {
    this.modicum = modicum;
    this.setData(width, height, data, isFloat, numChannels);
  }

  destroy() {
    if (this.modicum == null) {
      return;
    }
    this.modicum.gl.deleteTexture(this.nativeTex);
    this.nativeTex = null;
    this.data = null;
    this.modicum = null;
  }

  setData(width, height, data, isFloat = false, numChannels = 4) {
    this.width = width;
    this.height = height;
    this.data = isFloat ? Float32Array.from(data) : Uint8Array.from(data);

    const gl = this.modicum.gl;
    this.nativeTex = gl.createTexture();

    this.level = 0;
    this.format =
      gl[
        textureFormatsByChannelCount[numChannels - 1].find(
          format => gl[format] != null
        )
      ];
    this.type = isFloat ? gl.FLOAT : gl.UNSIGNED_BYTE;
    if (isFloat) {
      gl.getExtension("OES_texture_float");
      gl.getExtension("OES_texture_float_linear");
    }

    this.dirty = true;
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      const gl = this.modicum.gl;
      const tex2D = gl.TEXTURE_2D;
      gl.bindTexture(tex2D, this.nativeTex);
      gl.texImage2D(
        tex2D,
        this.level,
        this.format,
        this.width,
        this.height,
        0,
        this.format,
        this.type,
        this.data
      );
      gl.texParameteri(tex2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(tex2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(tex2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(tex2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
  }
}

export default Modicum;
