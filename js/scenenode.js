// @fileoverview scenenode - A barebones type for modeling scenes of nested renderable objects
// @author Jeremy Sachs
// @version 2.0.0

export default class SceneNode {
  constructor() {
    this.children = [];
    this.parent = null;
  }

  addChild(child, index) {
    if (child.parent != null) {
      child.parent.removeChild(child);
    }
    this.children.splice(index, 0, child);
    child.parent = this;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index != -1) this.removeChildAt(index);
  }

  removeChildAt(index) {
    this.children[index].parent = null;
    this.children.splice(index, 1);
  }

  removeChildren() {
    this.child.forEach(child => (child.parent = null));
    this.children.length = 0;
  }
}
