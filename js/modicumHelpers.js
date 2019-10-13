import Modicum from "./modicum.js";

const makeResizer = (modicum, func) => () => {
  modicum.canvas.width = modicum.canvas.clientWidth;
  modicum.canvas.height = modicum.canvas.clientHeight;
  modicum.resize();
  func(modicum.width, modicum.height);
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

const setAdditiveBlending = modicum => {
  modicum.tweak(gl => {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.DST_ALPHA);
  });
};

export { makeResizer, makeAnimator, setDepthTest, setAdditiveBlending };
