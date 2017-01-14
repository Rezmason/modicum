/**
 * @author Jeremy Sachs
 * @version 1.0.0
 */

function init() {
    var canvas = document.createElement("canvas");
    document.body.appendChild(canvas);

    var modicum = new Modicum(canvas);
    
    var program = new Program("shaders/simple.vert", "shaders/simple.frag", onReady);

    function onReady() {
        var scene = new UniformGroup(program);
        var camera = mat3.create();
        scene.setUniforms({
            uColorPalette:[
                0, 0, 0,
                1, 0, 0,
                0, 1, 0,
                0, 0, 1,
            ],
            uAlpha: [1.00]
        });

        var mesh1 = new Mesh(program, 6, 2);
        mesh1.setVertex(0, {aShape: [  0,   0,   0, 480, 640,   0], aColor: [3, 3, 3]});
        mesh1.setVertex(3, {aShape: [  0, 480, 640,   0, 640, 480], aColor: [1, 1, 1]});
        mesh1.setIndex(0, [0, 1, 2, 3, 4, 5]);
        var transform = mat3.create();
        mesh1.setUniforms({uTransform:transform});
        mesh1.update();

        var mesh2 = new Mesh(program, 3, 1);
        mesh2.setVertex(0, {aShape: [320, 100, 100, 480 - 100, 640 - 100, 480 - 100], aColor: [0, 0, 0]});
        mesh2.setIndex(0, [0, 1, 2]);
        var transform = mat3.create();
        mesh2.setUniforms({uTransform:transform});
        mesh2.update();

        program.activate();

        var animatedAlpha = 0;

        function resize() {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;

            mat3.identity(camera);
            mat3.scale(camera, camera, [1, -1]);
            mat3.translate(camera, camera, [-1, -1]);
            mat3.scale(camera, camera, [2 / canvas.width, 2 / canvas.height]);
            scene.setUniforms({uCamera:camera});

            modicum.resize();
            redraw();
        }

        function animate(time) {
            redraw();
            animatedAlpha = Math.sin(time * 0.001) / 2 + 0.5;
            window.requestAnimationFrame(animate);
        }

        function redraw() {
            modicum.clear();
            scene.setUniforms({uAlpha: [1.00]});
            modicum.drawMesh(program, mesh1, scene);
            scene.setUniforms({uAlpha: [animatedAlpha]});
            modicum.drawMesh(program, mesh2, scene);
        }

        window.onresize = resize;
        resize();
        animate();
    }
}
