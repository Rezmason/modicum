// Hanoi Rings, by Jeremy Sachs, 2016, yessiree

var PI = Math.PI;
var TWO_PI = PI * 2;
var canvas;
var modicum;
var program;
var camera;
var scene;
var base;
var ringContainer;
var rings;
var numActiveRings;
var hanoiItr;
var animTime;
var currentRing;
var ringStartAngle;
var ringEndAngle;
var ringStartAlpha;
var ringEndAlpha;
var startScale;
var endScale;

var lastTime;

function init() {
    canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    modicum = new Modicum(canvas);
    program = new Program("shaders/simple.vert", "shaders/simple.frag", onReady);
}

function onReady() {
    scene = new UniformGroup(program);
    camera = mat3.create();
    scene.setUniforms({
        uColorPalette:[
            0.07, 0.07, 0.07,
            // 0.36, 0.53, 0.63,
            0.35, 0.32, 0.78,
            0.93, 0.45, 0.07,
            1.00, 1.00, 1.00,
        ]
    });

    rings = [];
    ringContainer = new SceneNode();
    ringContainer.transform = new Transform();
    ringContainer.transform.scaleX = 0;
    ringContainer.transform.scaleY = 0;
    base = new SceneNode();
    base.transform = new Transform();
    base.addChild(ringContainer);

    hanoiItr = 0;
    animTime = 0;
    ringIndex = 0;

    program.activate();
    resize();
    window.onresize = resize;
    animate(0);
}

function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    mat3.identity(camera);
    mat3.scale(camera, camera, [1, -1]);
    mat3.translate(camera, camera, [-1, -1]);
    mat3.scale(camera, camera, [2 / canvas.width, 2 / canvas.height]);
    scene.setUniforms({uCamera:camera});

    base.transform.x = canvas.width / 2;
    base.transform.y = canvas.height / 2;
    base.transform.scaleX = Math.min(canvas.width, canvas.height);
    base.transform.scaleY = base.transform.scaleX;

    modicum.resize();
}

// It's the ruler function: https://oeis.org/A001511
function getRingIndex(t) {
    t++;
    var i = 0;
    while (((t >> i) & 1) == 0) i++;
    return i;
}

function animate(time) {
    var delta = ((lastTime != null) ? time - lastTime : 0) / 1000;
    lastTime = time;
    var speed = Math.pow(1.25, rings.length + 1) / (ringIndex + 1);
    animTime += delta * speed;
    if (animTime >= 1) {
        animTime = 0;
        if (currentRing != null) {
            currentRing.transform.rotation = ringEndAngle % TWO_PI;
            currentRing.transform.alpha = 1;
            ringContainer.transform.scaleY = endScale;
            ringContainer.transform.scaleX = endScale;
        }
        currentRing = null;
    }
    if (currentRing == null) {
        ringIndex = getRingIndex(hanoiItr);
        hanoiItr++;
        if (ringIndex == rings.length) {
            var ring = makeRing(rings.length);
            ringContainer.addChild(ring);
            ring.transform.rotation = PI * (0.25 + ringIndex * 0.05);
            ring.transform.alpha = 0;
            rings.push(ring);
        }

        startScale = ringContainer.transform.scaleX;
        endScale = 0.7 / (2 * rings[rings.length - 1].radius);
        currentRing = rings[ringIndex];
        ringStartAlpha = currentRing.transform.alpha;
        ringEndAlpha = 1;
        ringStartAngle = currentRing.transform.rotation;
        ringEndAngle = ringStartAngle + (ringIndex % 2 == 1 ? 1 : -1) * TWO_PI / 3;
    }

    var ratio = easeInOutQuad(0, animTime, 0, 1, 1);
    if (currentRing != null) {
        currentRing.transform.rotation = (1 - ratio) * ringStartAngle + ratio * ringEndAngle;
        currentRing.transform.alpha = (1 - ratio) * ringStartAlpha + ratio * ringEndAlpha;
    }

    if (startScale != endScale) {
        var scale = (1 - ratio) * startScale + ratio * endScale;
        ringContainer.transform.scaleY = scale;
        ringContainer.transform.scaleX = scale;
    }

    modicum.clear();
    drawNode(base);

    window.requestAnimationFrame(animate);
}

function makeRing(size) {
    var innerRadius = (size + 2) * 5;
    var outerRadius = innerRadius + 4;
    var ring = new SceneNode();
    ring.transform = new Transform();
    ring.radius = outerRadius;
    var arcSpan = PI / 3;
    for (var i = 0; i < 3; i++) {
        var arcStartAngle = TWO_PI / 3 * i;
        ring.addChild(makeArc(i + 1, innerRadius      , outerRadius      ,           arcStartAngle, arcSpan));
        ring.addChild(makeArc(    0, innerRadius + 1.5, outerRadius - 1.5, arcSpan + arcStartAngle, arcSpan));
    }
    return ring;
}

function makeArc(colorIndex, innerRadius, outerRadius, startAngle, totalAngle) {
    var positions = [];
    var numSegments = Math.floor(innerRadius * 8 * Math.abs(totalAngle) / TWO_PI);
    var numVertices = (numSegments + 1) * 2;
    var angleDiff = totalAngle / (numVertices - 2);
    for (var i = 0; i < numVertices; i += 2) {
        var angle = startAngle + i * angleDiff;
        positions.push(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
        positions.push(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
    }

    var colors = [];
    colors.length = numVertices;
    colors.fill(colorIndex);
    var numVertices = positions.length / 2;
    var numTriangles = numVertices - 2;
    var indices = [];
    for (i = 0; i < numTriangles; i++) {
        var p1 = i;
        var p2 = i + 1;
        var p3 = i + 2;
        indices.push(p1, p2, p3);
    }

    var mesh = new Mesh(program, numVertices, numTriangles);
    mesh.setVertex(0, {aShape: positions, aColor: colors});
    mesh.setIndex(0, indices);
    var transform = mat3.create();
    mesh.setUniforms({uTransform:transform});

    var node = new SceneNode();
    node.transform = new Transform();
    node.mesh = mesh;

    return node;
}

function drawNode(node) {
    node.transform.update();
    if (node.parent == null) node.transform.resetConcat();
    else node.transform.updateConcat(node.parent.transform);
    for (var i = node.children.length - 1; i >= 0; i--) drawNode(node.children[i]);
    if (node.mesh != null) {
        var matrix = node.parent == null ? node.transform.matrix : node.transform.concatenatedMatrix;
        var alpha = node.parent == null ? node.transform.alpha : node.transform.concatenatedAlpha;
        node.mesh.setUniforms({uTransform:matrix, uAlpha:[alpha]});
        modicum.drawMesh(program, node.mesh, scene);
    }
}

// (Does anyone even ask for Penner's permission anymore?!)
function easeInOutQuad(x, t, b, c, d) {
    if ((t/=d/2) < 1) return c/2*t*t + b;
    return -c/2 * ((--t)*(t-2) - 1) + b;
};
