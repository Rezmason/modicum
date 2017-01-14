/**
 * @fileoverview scenenode - A barebones type for modeling scenes of nested renderable objects
 * @author Jeremy Sachs
 * @version 1.0.0
 */

function SceneNode() {
    this.children = [];
    this.parent = null;
}

SceneNode.prototype = {
    addChild: function(child, index) {
        this.removeChild(child);
        this.children.splice(index, 0, child);
        child.parent = this;
    },
    removeChild: function(child) {
        var index = this.children.indexOf(child);
        if (index != -1) this.removeChildAt(index);
    },
    removeChildAt: function(index) {
        this.children[index].parent = null;
        this.children.splice(index, 1);
    },
    removeChildren: function() {
        for (var ike = 0; ike < this.children.length; ike++) {
            this.children[ike].parent = null;
        }
        this.children.length = 0;
    }
}
