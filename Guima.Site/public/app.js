// Guima - efeitos da pagina "em construcao": frases que se alternam, barra de progresso, cidade que sobe e faiscas no ceu.
// Sem bibliotecas e sem rede: so' DOM e canvas. Respeita "reduzir movimento" do sistema.
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1) Frases que se alternam (a primeira ja' esta' no HTML)
  var phrases = [
    'Todo grande sonho começa com uma obra.',
    'Cada tijolo é um sonho assentado.',
    'Hoje é obra. Amanhã é conquista.',
    'Sonhos não esperam: a gente constrói.',
    'O que está sendo erguido aqui vai valer a espera.'
  ];
  var phraseEl = document.getElementById('phrase');
  var i = 0;
  if (phraseEl && !reduce) {
    setInterval(function () {
      phraseEl.classList.add('out');
      setTimeout(function () {
        i = (i + 1) % phrases.length;
        phraseEl.textContent = phrases[i];
        phraseEl.classList.remove('out');
      }, 650);
    }, 4200);
  }

  // 2) Barra de progresso da "obra"
  var bar = document.getElementById('bar');
  if (bar) setTimeout(function () { bar.style.width = '72%'; }, 300);

  // 3) Cidade: predios com alturas variadas, subindo em sequencia, com um guindaste no meio
  var city = document.getElementById('city');
  if (city) {
    var total = 22, crane = Math.floor(total * 0.62);
    for (var n = 0; n < total; n++) {
      var el = document.createElement('div');
      if (n === crane) {
        el.className = 'crane';
        el.style.setProperty('--h', '92%');
      } else {
        el.className = 'b';
        el.style.setProperty('--h', (28 + Math.round(Math.abs(Math.sin(n * 1.7)) * 62)) + '%');
      }
      el.style.setProperty('--d', (n * 0.11).toFixed(2) + 's');
      city.appendChild(el);
    }
  }

  // 4) Faiscas douradas subindo (canvas leve; pausa quando a aba esta' escondida)
  var canvas = document.getElementById('sky');
  if (!canvas || reduce || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var running = false, w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), sparks = [];

  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawn(initial) {
    return { x: Math.random() * w, y: initial ? Math.random() * h : h + 10, r: Math.random() * 1.8 + .4,
             v: Math.random() * .6 + .25, drift: (Math.random() - .5) * .3, a: Math.random() * .6 + .3, hue: 28 + Math.random() * 30 };
  }
  function start() {
    resize();
    var count = Math.min(90, Math.floor((w * h) / 16000));
    sparks = [];
    for (var k = 0; k < count; k++) sparks.push(spawn(true));
  }
  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (var k = 0; k < sparks.length; k++) {
      var s = sparks[k];
      s.y -= s.v; s.x += s.drift;
      if (s.y < -10) sparks[k] = spawn(false);
      ctx.beginPath();
      ctx.fillStyle = 'hsla(' + s.hue + ', 100%, 65%, ' + s.a + ')';
      ctx.shadowColor = 'hsla(' + s.hue + ', 100%, 60%, .8)';
      ctx.shadowBlur = 8;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (document.hidden) { running = false; return; }
    requestAnimationFrame(frame);
  }
  function go() { if (!running) { running = true; requestAnimationFrame(frame); } }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) go(); });
  window.addEventListener('resize', start);
  start();
  go();
})();
