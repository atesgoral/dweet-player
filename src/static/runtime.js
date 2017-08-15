var c = document.querySelector("#c");

c.width = 1920;
c.height = 1080;

var S = Math.sin;
var C = Math.cos;
var T = Math.tan;

function R(r,g,b,a) {
  a = a === undefined ? 1 : a;
  return "rgba("+(r|0)+","+(g|0)+","+(b|0)+","+a+")";
};

var x = c.getContext("2d");
var time = 0;
var frame = 0;

let u = function () {};

function loop() {
  requestAnimationFrame(loop);

  time = frame / 60;

  if (time * 60 | 0 == frame - 1) {
    time += 0.000001;
  }

  frame++;

  try {
    u(time);
  } catch (e) {
    throw e;
  }
}

let id = 3060;

function fetch(id) {
  $.ajax(`/api/dweets/${id}`, { dataType: 'text' })
    .then((response) => {
      $.globalEval(`u = ${response}`);
    })
}

$(() => {
  fetch(id);

  loop();
});
