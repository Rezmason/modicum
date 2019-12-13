![Hanoi screenshot.](/hanoi_screenshot.png?raw=true "How the Hanoi graphic demo appears a few minutes in.")

# Modicum

Modicum is a small standalone WebGL wrapper to support small projects, written in plain old ECMAScript. It's all the WebGL calls you didn't want to make yourself.

# Why does this exist, when [three.js](https://threejs.org) works?

Well, three.js is optimized for composing and rendering scenes of many nested 3D objects, via shaders nestled within a standard suite of materials.

- Even if your project depicts a single object, in three.js you'll need to make a scene, make a mesh, assign it a material, make a camera, add the camera and mesh to the scene, and point the camera at the mesh.
- Furthermore, if your project is mainly an overglorified shader, in three.js you'll need to make a custom material to assign to your mesh.

With Modicum, you build your project from the shaders up.

- Shaders already require various kinds of data, which the WebGL API [can](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getActiveUniform) [report](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getActiveAttrib).
- Modicum simply helps you satisfy these requirements, by building you objects to feed to your shaders.
- You won't need to make anything that doesn't directly support those shaders.

Consequently, Modicum is barebones:

- It has no [scene graph](https://en.wikipedia.org/wiki/Scene_graph) — though an optional one is in this repo.
- It has no [materials system](https://en.wikipedia.org/wiki/Materials_system). Your shader's the boss, not the geometry.
- It has no [transformation matrices](https://en.wikipedia.org/wiki/Transformation_matrix), because [glMatrix already does.](http://glmatrix.net).

And while three.js is pretty great, it has grown pretty big. Modicum is simpler, smaller, and ducks out of your way.

If you really want to, you can read and understand Modicum in under thirty minutes.

# Contributing

If you have an interest in this project, please [contact me](mailto:jeremysachs@rezmason.net).

# Legal?

**The short version:** you can use Modicum in your project. If you change it, please share your changes!

**The long version:** the source for Modicum is released under the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
