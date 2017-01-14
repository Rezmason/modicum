/**
 * @fileoverview transform - A gl-matrix wrapper that exposes a simpler interface
 * @author Jeremy Sachs
 * @version 1.0.0
 */

function Transform() {
    this.x = 0;
    this.y = 0;
    this.rotation = 0;
    this.scaleX = 1;
    this.scaleY = 1;

    this.matrix = mat3.create();
    this.concatenatedMatrix = mat3.create();

    this.alpha = 1;
    this.concatenatedAlpha = 1;
}

Transform.prototype = {
    update: function() {
        var matrix = this.matrix;
        mat3.identity(matrix);
        mat3.translate(matrix, matrix, [this.x, this.y]);
        mat3.scale(matrix, matrix, [this.scaleX, this.scaleY]);
        mat3.rotate(matrix, matrix, this.rotation);
    },
    updateConcat: function(other) {
        mat3.multiply(this.concatenatedMatrix, other.concatenatedMatrix, this.matrix);
        this.concatenatedAlpha = this.alpha * other.alpha;
    },
    resetConcat: function() {
        mat3.copy(this.concatenatedMatrix, this.matrix);
    }
}
