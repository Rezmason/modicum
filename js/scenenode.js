// @fileoverview scenenode - A barebones type for modeling scenes of nested renderable objects
// @author Jeremy Sachs
// @version 2.0.0

export default class SceneNode {
  constructor(properties) {
    this.children = [];
    this.parent = null;
    for (let key in properties) {
      this[key] = properties[key];
    }
  }

  addChild(child, index) {
    if (child.parent != null) {
      child.parent.removeChild(child);
    }
    this.children.splice(index, 0, child);
    child.parent = this;
    return this;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index != -1) this.removeChildAt(index);
    return this;
  }

  removeChildAt(index) {
    this.children[index].parent = null;
    this.children.splice(index, 1);
    return this;
  }

  removeChildren() {
    this.child.forEach(child => (child.parent = null));
    this.children.length = 0;
    return this;
  }
}
