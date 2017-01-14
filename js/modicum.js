/**
 * @fileoverview modicum - A simplistic API for small scale WebGL projects
 * @author Jeremy Sachs
 * @version 1.0.0
 */

function Modicum(canvas) {
    this.canvas = canvas;
    var gl = canvas.getContext("webgl", {premultipliedAlpha:false, alpha:false});
    Modicum.gl = gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.resize();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(Modicum.gl.COLOR_BUFFER_BIT);
    gl.colorMask(true, true, true, false);
}

Modicum.prototype = {
    resize: function(width, height) {
        if (width  == null) width  = Modicum.gl.drawingBufferWidth;
        if (height == null) height = Modicum.gl.drawingBufferHeight;
        this.width = width;
        this.height = height;
        Modicum.gl.viewport(0, 0, this.width, this.height);
    },
    clear: function(color) {
        if (color != null) Modicum.gl.clearColor(color.r, color.g, color.b, color.a);
        Modicum.gl.clear(Modicum.gl.COLOR_BUFFER_BIT/* | Modicum.gl.DEPTH_BUFFER_BIT*/);
    },
    drawMesh(program, mesh, other) {
        mesh.update();
        var gl = Modicum.gl;
        if (other == null) other = mesh.uniformGroup;
        for (var prop in program.uniformData) {
            var uniform = (prop in mesh.uniformGroup.uniformsUsed ? mesh.uniformGroup : other).uniforms[prop];
            var uniformDatum = program.uniformData[prop];
            uniformDatum.format.assign(uniformDatum.location, uniform);
        }
        for (var prop in program.attributeData) {
            var attributeDatum = program.attributeData[prop];
            var index = attributeDatum.index;
            var format = attributeDatum.format;
            var vertexBuffer = mesh.vertexBuffers[prop];
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.buffer);
            gl.vertexAttribPointer(index, format.stride, format.type, false, 0, 0);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer.buffer);
        gl.drawElements(gl.TRIANGLES, mesh.numIndices, Modicum.gl.UNSIGNED_SHORT, 0);
    }
}

function LoadJob(url, onComplete) {
    function handleComplete() {
        onComplete(url, req.responseText);
    }
    var req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.addEventListener("load", handleComplete, false);
    req.send();
}

function Program(vertURL, fragURL, onReady) {
    this.ready = false;
    this.onReady = onReady;
    this.initFormats();
    this.vertURL = vertURL;
    this.fragURL = fragURL;
    new LoadJob(vertURL, this.onShaderLoad.bind(this));
    new LoadJob(fragURL, this.onShaderLoad.bind(this));
}

Program.prototype = {
    initFormats: function() {
        if (Program.formats == null) {
            var gl = Modicum.gl;
            var formats = {};
            
            formats[gl.FLOAT     ] = {stride:1, type:gl.FLOAT, bType:Float32Array, assign:gl.uniform1fv.bind(gl)};
            formats[gl.FLOAT_VEC2] = {stride:2, type:gl.FLOAT, bType:Float32Array, assign:gl.uniform2fv.bind(gl)};
            formats[gl.FLOAT_VEC3] = {stride:3, type:gl.FLOAT, bType:Float32Array, assign:gl.uniform3fv.bind(gl)};
            formats[gl.FLOAT_VEC4] = {stride:4, type:gl.FLOAT, bType:Float32Array, assign:gl.uniform4fv.bind(gl)};
            
            function flattenMatFunc(func) {
                func = func.bind(gl);
                return function(loc, mat) { func(loc, false, mat) };
            }
            formats[gl.FLOAT_MAT2] = {stride: 4, type:gl.FLOAT, bType:Float32Array, assign:flattenMatFunc(gl.uniformMatrix2fv)};
            formats[gl.FLOAT_MAT3] = {stride: 9, type:gl.FLOAT, bType:Float32Array, assign:flattenMatFunc(gl.uniformMatrix3fv)};
            formats[gl.FLOAT_MAT4] = {stride:16, type:gl.FLOAT, bType:Float32Array, assign:flattenMatFunc(gl.uniformMatrix4fv)};
            Program.formats = formats;
        }
    },
    onShaderLoad: function(url, source) {
        if (url == this.vertURL) this.vertSource = source;
        if (url == this.fragURL) this.fragSource = source;
        if (this.vertSource != null && this.fragSource != null) {

            var vertexShader = this.processShader(Modicum.gl.VERTEX_SHADER, this.vertSource);
            var fragmentShader = this.processShader(Modicum.gl.FRAGMENT_SHADER, this.fragSource);

            var nativeProg = Modicum.gl.createProgram();
            this.nativeProg = nativeProg;
            Modicum.gl.attachShader(nativeProg, vertexShader);
            Modicum.gl.attachShader(nativeProg, fragmentShader);
            Modicum.gl.linkProgram(nativeProg);

            if (!Modicum.gl.getProgramParameter(nativeProg, Modicum.gl.LINK_STATUS)) {
                alert("Could not initialise shaders");
            }

            var ike;
            var name;

            this.uniformData = {};
            var numActiveUniforms = Modicum.gl.getProgramParameter(nativeProg, Modicum.gl.ACTIVE_UNIFORMS);
            for (ike = 0; ike < numActiveUniforms; ike++) {
                var uniform = Modicum.gl.getActiveUniform(nativeProg, ike);
                name = uniform.name.split('[')[0];
                var location = Modicum.gl.getUniformLocation(nativeProg, uniform.name);
                this.uniformData[name] = {size:uniform.size, location:location, format:Program.formats[uniform.type]};
            }

            this.attributeData = {};
            var numActiveAttributes = Modicum.gl.getProgramParameter(nativeProg, Modicum.gl.ACTIVE_ATTRIBUTES);
            for (ike = 0; ike < numActiveAttributes; ike++) {
                var attribute = Modicum.gl.getActiveAttrib(nativeProg, ike);
                name = attribute.name.split('[')[0];
                this.attributeData[name] = {index:ike, format:Program.formats[attribute.type]};
            }

            this.ready = true;
            this.onReady();
        }
    },
    activate: function() {
        Modicum.gl.useProgram(this.nativeProg);
        for (var prop in this.attributeData) Modicum.gl.enableVertexAttribArray(this.attributeData[prop].index);
    },
    deactivate: function() {
        Modicum.gl.useProgram(null);
        for (var prop in this.attributeData) Modicum.gl.disableVertexAttribArray(this.attributeData[prop].index);
    },
    processShader(type, source) {
        var shader = Modicum.gl.createShader(type);
        Modicum.gl.shaderSource(shader, source);
        Modicum.gl.compileShader(shader);

        if (!Modicum.gl.getShaderParameter(shader, Modicum.gl.COMPILE_STATUS)) {
            throw Modicum.gl.getShaderInfoLog(shader);
            return null;
        }
        return shader;
    }
}

function Mesh(program, numVertices, numTriangles) {
    this.numVertices = numVertices;
    this.numTriangles = numTriangles;
    this.numIndices = numTriangles * 3;
    this.uniformGroup = new UniformGroup(program);
    this.vertexBuffers = {};
    for (var prop in program.attributeData) {
        this.vertexBuffers[prop] = new VertexBuffer(program.attributeData[prop].format, numVertices);
    }
    this.indexBuffer = new IndexBuffer(this.numIndices);
    this.setIndex = this.indexBuffer.setIndex.bind(this.indexBuffer);
    this.setUniforms = this.uniformGroup.setUniforms.bind(this.uniformGroup);
    this.dirty = true;
}

Mesh.prototype = {
    setVertex(index, values) {
        for (var prop in values) this.vertexBuffers[prop].setVertex(index, values[prop]);
    },
    update() {
        this.indexBuffer.update();
        for (var prop in this.vertexBuffers) this.vertexBuffers[prop].update();
    },
    get dirty() {
        if (this.indexBuffer.dirty) return true;
        for (var prop in this.vertexBuffers) if (this.vertexBuffers[prop].dirty) return true;
        return false;
    }
}

function UniformGroup(program) {
    this.uniforms = {};
    this.uniformsUsed = {};
    for (var prop in program.uniformData) {
        var uniformDatum = program.uniformData[prop];
        var format = uniformDatum.format;
        this.uniforms[prop] = new format.bType(uniformDatum.size * format.stride);
    }
}

UniformGroup.prototype = {
    setUniforms(values) {
        for (var prop in values) {
            this.uniformsUsed[prop] = true;
            this.uniforms[prop].set(values[prop]);
        }
    }
}

function IndexBuffer(numIndices) {
    this.buffer = Modicum.gl.createBuffer();
    this.indices = new Uint16Array(numIndices);
    this.dirty = true;
}

IndexBuffer.prototype = {
    setIndex(index, values) {
        this.indices.set(values, index);
        this.dirty = true;
    },
    setTriangle(triangleIndex, values) {
        this.setIndex(triangleIndex * 3, values);
    },
    update() {
        if (this.dirty) {
            this.dirty = false;
            Modicum.gl.bindBuffer(Modicum.gl.ELEMENT_ARRAY_BUFFER, this.buffer);
            Modicum.gl.bufferData(Modicum.gl.ELEMENT_ARRAY_BUFFER, this.indices, Modicum.gl.STATIC_DRAW);
        }
    }
}

function VertexBuffer(format, numVertices) {
    this.numVertices = numVertices;
    this.stride = format.stride;
    this.buffer = Modicum.gl.createBuffer();
    this.vertices = new format.bType(numVertices * format.stride);
    this.dirty = true;
}

VertexBuffer.prototype = {
    setVertex(index, values) {
        this.vertices.set(values, index * this.stride);
        this.dirty = true;
    },
    update() {
        if (this.dirty) {
            this.dirty = false;
            Modicum.gl.bindBuffer(Modicum.gl.ARRAY_BUFFER, this.buffer);
            Modicum.gl.bufferData(Modicum.gl.ARRAY_BUFFER, this.vertices, Modicum.gl.STATIC_DRAW);
        }
    }
}
