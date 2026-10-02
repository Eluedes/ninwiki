// Guima Company - efeitos da pagina "em construcao": chuva de codigo, terminal que digita, build com porcentagem e frases que se alternam.
// Sem bibliotecas e sem rede: so' DOM e canvas. Respeita "reduzir movimento" do sistema.
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 1) Terminal: linhas "digitadas" ----------
  var script = [
    { t: '<span class="info">[1/5]</span> compilando ideias ........ <span class="ok">ok</span>' },
    { t: '<span class="info">[2/5]</span> importando coragem ........ <span class="ok">ok</span>' },
    { t: '<span class="info">[3/5]</span> refatorando o futuro ...... <span class="ok">ok</span>' },
    { t: '<span class="info">[4/5]</span> rodando os sonhos ......... <span class="warn">72%</span>' },
    { t: '<span class="info">[5/5]</span> deploy: <span class="ok">em breve</span> <span class="cursor"></span>' }
  ];
  var term = document.getElementById('term');
  var bar = document.getElementById('bar');
  var pct = document.getElementById('pct');
  var TARGET = 72;

  /** Mostra uma linha de cada vez (ou tudo de uma vez se o movimento reduzido estiver ligado). */
  function runTerminal() {
    if (!term) return;
    var idx = 0;
    function next() {
      if (idx >= script.length) return;
      var line = document.createElement('span');
      line.className = 'line';
      line.innerHTML = script[idx].t;   // texto fixo escrito aqui (nunca vem de fora)
      term.appendChild(line);
      idx += 1;
      if (!reduce) setTimeout(next, 650);
      else next();
    }
    setTimeout(next, reduce ? 0 : 500);
  }

  // ---------- 2) Barra de build com contador ----------
  function runBar() {
    if (!bar || !pct) return;
    if (reduce) { bar.style.width = TARGET + '%'; pct.textContent = TARGET + '%'; return; }
    setTimeout(function () { bar.style.width = TARGET + '%'; }, 300);
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / 2600, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      pct.textContent = Math.round(eased * TARGET) + '%';
      if (p < 1) requestAnimationFrame(tick);
    }
    setTimeout(function () { requestAnimationFrame(tick); }, 300);
  }

  runTerminal();
  runBar();

  // ---------- 3) Chuva de codigo (canvas leve; pausa quando a aba esta' escondida) ----------
  var canvas = document.getElementById('code');
  if (!canvas || reduce || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var chars = '01{}[]()<>/;=+*#$%&!?~abcdefghijklmnopqrstuvwxyz'.split('');
  var running = false, w = 0, h = 0, fs = 16, cols = 0, drops = [], last = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fs = w < 640 ? 14 : 16;
    cols = Math.ceil(w / fs);
    drops = [];
    for (var c = 0; c < cols; c++) drops.push(Math.random() * -40);
    ctx.fillStyle = '#050914';
    ctx.fillRect(0, 0, w, h);
  }
  function frame(ts) {
    if (document.hidden) { running = false; return; }
    requestAnimationFrame(frame);
    if (ts - last < 55) return;          // ~18 quadros por segundo: leve e com cara de terminal
    last = ts;
    ctx.fillStyle = 'rgba(5, 9, 20, .14)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = fs + 'px ui-monospace, Menlo, Consolas, monospace';
    for (var c = 0; c < cols; c++) {
      var y = drops[c] * fs;
      if (y > 0) {
        ctx.fillStyle = Math.random() > .93 ? '#e8ecf8' : (c % 7 === 0 ? '#a78bfa' : '#22d3ee');
        ctx.fillText(chars[(Math.random() * chars.length) | 0], c * fs, y);
      }
      if (y > h && Math.random() > .975) drops[c] = Math.random() * -20;
      drops[c] += 1;
    }
  }
  function go() { if (!running) { running = true; requestAnimationFrame(frame); } }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) go(); });
  window.addEventListener('resize', resize);
  resize();
  go();
})();
