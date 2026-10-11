var text = new Blotter.Text("ant toys", {
	family : "monospace",
	size : 50,
	fill : "black",
});

var material = new Blotter.FliesMaterial();

material.uniforms.uPointCellWidth.value = 0.02;
material.uniforms.uPointRadius.value = 1;
material.uniforms.uSpeed.value = 5;

var blotter = new Blotter(material, { 
	texts : text,
});

var scope = blotter.forText(text);

scope.appendTo(document.querySelector('header'));