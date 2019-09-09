const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const rgbToHSV = ({ r, g, b }) => {
  r = clamp(r);
  g = clamp(g);
  b = clamp(b);

  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);

  let h = 0;
  if (max > min) {
    if (max === r) {
      h = 60 * (0 + (g - b) / (max - min));
    } else if (max === g) {
      h = 60 * (2 + (b - r) / (max - min));
    } else if (max === b) {
      h = 60 * (4 + (r - g) / (max - min));
    }
  }

  const s = max === 0 ? 0 : (max - min) / max;
  const v = max;

  return { h, s, v };
};

const f = (h, s, v, n) => {
  const k = (n + h / 60) % 6;
  return v - v * s * clamp(Math.min(k, 4 - k));
};
const hsvToRGB = ({ h, s, v }) => {
  h = clamp(h, 0, 360);
  s = clamp(s);
  v = clamp(v);
  const [r, g, b] = [f(h, s, v, 5), f(h, s, v, 3), f(h, s, v, 1)];
  return { r, g, b };
};

export { rgbToHSV, hsvToRGB };
