// @fileoverview modicum - A simplistic API for small scale WebGL projects
// @author Jeremy Sachs
// @version 2.0.0

const getParam = (o, name, defaultValue) =>
  o == null || o[name] == null ? defaultValue : o[name];

const createSamplerFormats = ({ gl }) => ({
  [gl.SAMPLER_2D]: {
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
      const nativeTex = texture != null ? texture.nativeTex : null;
      gl.bindTexture(gl.TEXTURE_2D, nativeTex);
      if (texture != null) {
        texture.update();
      }
    }
  }
});

const expandData = (data, isByte, numChannels) => {
  if (numChannels === 4) return data;
  const alpha = isByte ? 0xff : 1;

  const remainder = Array(4 - numChannels).fill(0);
  remainder[remainder.length - 1] = alpha;

  return data.reduce((array, value, index) => {
    array.push(value);
    if ((index + 1) % numChannels === 0) {
      array.push(...remainder);
    }
    return array;
  }, []);
};

const loadImageTexture = async (gl, imageURL, params = null) => {
  const isFloat =
    getParam(params, "isFloat", false) ||
    getParam(params, "isHalfFloat", false);
  const numChannels = Math.min(4, getParam(params, "numChannels", 4));
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
  return new Texture(gl, image.width, image.height, data, params);
};

const isPowerOfTwo = x => (x & (x - 1)) == 0;

/**
 * Practically carbon copied from Jeroen van der Zijp's paper:
 * ftp://ftp.fox-toolkit.org/pub/fasthalffloatconversion.pdf
 **/

const baseTable = [];
const shiftTable = [];

for (let i = 0; i < 256; i++) {
  const e = i - 127;
  if (e < -24) {
    baseTable[i | 0x100] = 0x8000;
    shiftTable[i | 0x000] = 24;
    shiftTable[i | 0x100] = 24;
  } else if (e < -14) {
    // Small numbers map to denorms
    baseTable[i | 0x000] = 0x0400 >> (-e - 14);
    baseTable[i | 0x100] = (0x0400 >> (-e - 14)) | 0x8000;
    shiftTable[i | 0x000] = -e - 1;
    shiftTable[i | 0x100] = -e - 1;
  } else if (e <= 15) {
    // Normal numbers just lose precision
    baseTable[i | 0x000] = (e + 15) << 10;
    baseTable[i | 0x100] = ((e + 15) << 10) | 0x8000;
    shiftTable[i | 0x000] = 13;
    shiftTable[i | 0x100] = 13;
  } else if (e < 128) {
    // Large numbers map to Infinity
    baseTable[i | 0x000] = 0x7c00;
    baseTable[i | 0x100] = 0xfc00;
    shiftTable[i | 0x000] = 24;
    shiftTable[i | 0x100] = 24;
  } else {
    // Infinity and NaN's stay Infinity and NaNs
    baseTable[i | 0x000] = 0x7c00;
    baseTable[i | 0x100] = 0xfc00;
    shiftTable[i | 0x000] = 13;
    shiftTable[i | 0x100] = 13;
  }
}

const hfBuf = new ArrayBuffer(4);
const hfFloat = new Float32Array(hfBuf);
const hfUint = new Uint32Array(hfBuf);

const floatToHalfFloat = float => {
  hfFloat[0] = float;
  const floatRep = hfUint[0];
  const index = (floatRep >> 23) & 0x1ff;
  return baseTable[index] + ((floatRep & 0x007fffff) >> shiftTable[index]);
};

class Texture {
  constructor(gl, width, height, data, params) {
    this.gl = gl;
    this.nativeTex = gl.createTexture();
    this.isFloat = false;
    this.isHalfFloat = false;
    this.smooth = true;
    this.repeat = false;
    this.numChannels = 4;
    this.setData(width, height, data, params);
  }

  destroy() {
    if (this.gl == null) {
      return;
    }
    this.gl.deleteTexture(this.nativeTex);
    this.nativeTex = null;
    this.data = null;
    this.gl = null;
  }

  setData(width, height, data, params) {
    this.dimensionsChanged = this.width !== width || this.height !== height;
    this.width = width;
    this.height = height;

    if (params != null) {
      this.isFloat = getParam(params, "isFloat", false);
      this.isHalfFloat = getParam(params, "isHalfFloat", false);
      this.smooth = getParam(params, "smooth", true);
      this.repeat = getParam(params, "repeat", false);
      this.flipY = getParam(params, "flipY", false);
      this.numChannels = Math.min(4, getParam(params, "numChannels", 4));
    }

    if (data == null) {
      this.data = null;
    } else {
      const isByte = !(this.isFloat || this.isHalfFloat);
      this.data = this.isFloat
        ? Float32Array.from(expandData(data, isByte, this.numChannels))
        : this.isHalfFloat
        ? Uint16Array.from(
            expandData(data, isByte, this.numChannels).map(floatToHalfFloat)
          )
        : Uint8Array.from(expandData(data, isByte, this.numChannels));
    }

    if (this.repeat && !(isPowerOfTwo(width) && isPowerOfTwo(height))) {
      console.warn("WebGL won't let you repeat a non-power-of-two texture.");
      this.repeat = false;
    }

    const gl = this.gl;

    this.level = 0;
    this.internalFormat = this.isFloat
      ? gl[["RGBA32F", "RGBA"].find(format => gl[format] != null)]
      : this.isHalfFloat
      ? gl[["RGBA16F", "RGBA"].find(format => gl[format] != null)]
      : gl.RGBA;
    this.format = gl.RGBA;

    let halfFloatType;
    if (this.isFloat) {
      const version = gl.getParameter(gl.VERSION).startsWith("WebGL 2.0")
        ? 2
        : 1;
      if (version === 1) {
        gl.getExtension("OES_texture_float");
      }
      if (this.smooth) {
        gl.getExtension("OES_texture_float_linear");
      }
    } else if (this.isHalfFloat) {
      const version = gl.getParameter(gl.VERSION).startsWith("WebGL 2.0")
        ? 2
        : 1;
      if (version === 1) {
        gl.getExtension("EXT_color_buffer_half_float");
        const ext = gl.getExtension("OES_texture_half_float");
        halfFloatType = ext.HALF_FLOAT_OES;
      } else {
        halfFloatType = gl.HALF_FLOAT;
      }
      if (this.smooth) {
        gl.getExtension("OES_texture_half_float_linear");
      }
    }

    this.type = this.isFloat
      ? gl.FLOAT
      : this.isHalfFloat
      ? halfFloatType
      : gl.UNSIGNED_BYTE;

    this.filter = this.smooth ? gl.LINEAR : gl.NEAREST;
    this.wrappingFunction = this.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;

    this.dirty = true;
    return this;
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      const gl = this.gl;
      const tex2D = gl.TEXTURE_2D;
      gl.bindTexture(tex2D, this.nativeTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.flipY);
      if (this.dimensionsChanged) {
        gl.texImage2D(
          tex2D,
          this.level,
          this.internalFormat,
          this.width,
          this.height,
          0, // border "must be zero"
          this.format,
          this.type,
          this.data
        );
      } else {
        gl.texSubImage2D(
          tex2D,
          this.level,
          0, // x offset
          0, // y offset
          this.width,
          this.height,
          this.format,
          this.type,
          this.data
        );
      }
      this.data = null;
      this.dimensionsChanged = false;
      gl.texParameteri(tex2D, gl.TEXTURE_WRAP_S, this.wrappingFunction);
      gl.texParameteri(tex2D, gl.TEXTURE_WRAP_T, this.wrappingFunction);
      gl.texParameteri(tex2D, gl.TEXTURE_MIN_FILTER, this.filter);
      gl.texParameteri(tex2D, gl.TEXTURE_MAG_FILTER, this.filter);
    }
    return this;
  }
}

class Target {
  constructor(gl, width, height, params) {
    this.gl = gl;
    this.nativeFrameBuf = gl.createFramebuffer();
    this.params = params;
    if (
      getParam(params, "isFloat", false) ||
      getParam(params, "isHalfFloat", false)
    ) {
      const version = gl.getParameter(gl.VERSION).startsWith("WebGL 2.0")
        ? 2
        : 1;
      if (version === 2) {
        gl.getExtension("EXT_color_buffer_float");
      } else {
        gl.getExtension("WEBGL_color_buffer_float");
      }
      gl.getExtension("EXT_float_blend");
      // TODO: warn about floating point buffer support with api choice
    }
    if (getParam(params, "color", true)) {
      this.colorTexture = new Texture(gl, width, height, null, params);
    }
    this.resize(width, height);
  }

  destroy() {
    if (this.gl == null) {
      return;
    }
    this.gl.deleteFramebuffer(this.nativeFrameBuf);
    this.nativeFrameBuf = null;
    this.params = null;
    if (this.colorTexture != null) {
      this.colorTexture.destroy();
      this.colorTexture = null;
    }
  }

  resize(width, height) {
    if (this.width !== width && this.height !== height) {
      this.width = width;
      this.height = height;
      const gl = this.gl;

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.nativeFrameBuf);
      if (this.colorTexture != null) {
        this.colorTexture.setData(width, height, null, this.params);
        this.colorTexture.dimensionsChanged = true;
        this.colorTexture.update();
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          this.colorTexture.nativeTex,
          0
        );
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  }
}

export { Texture, loadImageTexture, Target, createSamplerFormats };
