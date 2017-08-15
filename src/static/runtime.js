function getRenderer() {
  var $ = undefined;

  var c = document.createElement('canvas');

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

  eval(`var u = ${arguments[0]}`);

  return {
    canvas: c,
    advance: function (amount) {
      time = frame / 60;

      if (time * 60 | 0 == frame - 1) {
        time += 0.000001;
      }

      frame += amount;
    },
    render: function () {
      u(time);
    }
  };
}

$(function () {
  let renderer = null;

  const canvas = $("#c").get(0);

  canvas.width = 1920;
  canvas.height = 1080;

  const ctx = canvas.getContext('2d');

  let frameCount = 0;

  function loop() {
    requestAnimationFrame(loop);

    const advanceAmount = Math.sin(frameCount / 10);

    frameCount++;

    const renderer = renderers[(frameCount / 100 | 0) % renderers.length];

    renderer.advance(advanceAmount);

    try {
      renderer.render();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        renderer.canvas,
        0, 0, renderer.canvas.width, renderer.canvas.width * 1080 / 1920,
        0, 0, canvas.width, canvas.height
      );
    } catch (e) {
      console.error(e);
    }
  }

  let ids = [ 701, 888, 1231, 739, 933, 676, 855, 683, 1829, 697, 433, 135 ];
  let renderers = [];

  function fetch(id) {
    return $.ajax(`/api/dweets/${id}`, { dataType: 'text' }).then(getRenderer);
  }

  const fetches = ids
    .sort(function () { return Math.random() - 0.5; })
    .slice(0, 3)
    .map(fetch);

  Promise.all(fetches)
    .then(function (_renderers) {
      renderers = _renderers;
      loop();
    });
});
