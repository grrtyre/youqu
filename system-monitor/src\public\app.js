// 系统监控器 - 前端逻辑
(function () {
  "use strict";

  const R = 50;
  const CIRC = 2 * Math.PI * R;

  function fmtBytes(n) {
    if (!n || n < 0) return "0 B";
    const u = ["B", "KB", "MB", "GB", "TB", "PB"];
    let i = 0; let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + " " + u[i];
  }
  function fmtBytesSec(n) { return fmtBytes(n) + "/s"; }
  function fmtBytesShort(n) {
    if (!n || n < 0) return "0";
    if (n < 1024) return n.toFixed(0) + "B";
    const u = ["K", "M", "G", "T"];
    let v = n / 1024; let i = 0;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + u[i];
  }
  function fmtUptime(sec) {
    if (!sec || sec < 0) return "—";
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (d > 0) return d + " 天 " + h + " 时 " + m + " 分";
    if (h > 0) return h + " 时 " + m + " 分";
    if (m > 0) return m + " 分 " + s + " 秒";
    return s + " 秒";
  }
  function setArc(el, percent) {
    if (!el) return;
    const p = Math.max(0, Math.min(100, percent));
    el.style.strokeDashoffset = CIRC * (1 - p / 100);
  }
  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function drawChart(canvas, data, color, fill, fixedMax) {
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const padL = 32, padR = 10, padT = 10, padB = 12;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const max = fixedMax != null ? fixedMax : Math.max(1, Math.max.apply(null, data || [1]) * 1.15);

    ctx.font = "11px -apple-system, 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    const ticks = fixedMax != null ? [100, 75, 50, 25, 0] : [max, max * 0.75, max * 0.5, max * 0.25, 0];
    ctx.strokeStyle = "rgba(0,0,0,0.035)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + innerW, y);
      ctx.stroke();
      const label = fixedMax != null ? ticks[i] + "" : (ticks[i] >= 100 ? Math.round(ticks[i]) : ticks[i].toFixed(0));
      ctx.fillText(label, padL - 6, y);
    }

    if (!data || data.length < 1) return;
    const n = data.length;
    const step = innerW / Math.max(1, 60 - 1);

    if (fill) {
      const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH);
      grad.addColorStop(0, fill);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.moveTo(padL, padT + innerH);
      for (let i = 0; i < n; i++) {
        const x = padL + i * step;
        const y = padT + innerH - (data[i] / max) * innerH;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(padL + (n - 1) * step, padT + innerH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = padL + i * step;
      const y = padT + innerH - (data[i] / max) * innerH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    if (n > 0) {
      const x = padL + (n - 1) * step;
      const y = padT + innerH - (data[n - 1] / max) * innerH;
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawNetChart(canvas, rx, tx) {
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const padL = 48, padR = 10, padT = 10, padB = 12;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const all = (rx || []).concat(tx || []);
    const max = Math.max(1, all.length ? Math.max.apply(null, all) * 1.2 : 1);

    ctx.font = "11px -apple-system, 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.strokeStyle = "rgba(0,0,0,0.035)";
    ctx.lineWidth = 1;
    const tickVals = [max, max * 0.75, max * 0.5, max * 0.25, 0];
    for (let i = 0; i <= 4; i++) {
      const y = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + innerW, y);
      ctx.stroke();
      ctx.fillText(fmtBytesShort(tickVals[i]) + "/s", padL - 6, y);
    }

    if (!all.length) return;
    const step = innerW / Math.max(1, 60 - 1);

    function line(arr, color, fill) {
      const n = arr.length;
      if (fill) {
        const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH);
        grad.addColorStop(0, fill);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.moveTo(padL, padT + innerH);
        for (let i = 0; i < n; i++) {
          const x = padL + i * step;
          const y = padT + innerH - (arr[i] / max) * innerH;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(padL + (n - 1) * step, padT + innerH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = padL + i * step;
        const y = padT + innerH - (arr[i] / max) * innerH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }

    line(rx, "#3a8dff", "rgba(58,141,255,0.14)");
    line(tx, "#86868b", "rgba(134,134,139,0.12)");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function render(s) {
    if (!s || !s.ts) return;

    setText("cpuNum", Math.round(s.cpu.load));
    setArc(document.getElementById("cpuArc"), s.cpu.load);
    setText("cpuModel", s.cpu.model || "CPU");
    setText("cpuCores", (s.cpu.cores || 0) + " 核");
    setText("cpuTemp", s.cpu.temp ? "温度 " + Math.round(s.cpu.temp) + "°C" : "温度 —");

    setText("memNum", Math.round(s.mem.percent));
    setArc(document.getElementById("memArc"), s.mem.percent);
    setText("memUsed", fmtBytes(s.mem.active) + " / " + fmtBytes(s.mem.total));
    setText("memSwap", s.swap.total > 0 ? "交换 " + Math.round(s.swap.percent) + "%" : "交换 —");

    setText("diskNum", Math.round(s.disk.percent));
    setArc(document.getElementById("diskArc"), s.disk.percent);
    setText("diskUsed", fmtBytes(s.disk.used) + " / " + fmtBytes(s.disk.total));
    setText("diskIo", "读 " + fmtBytesSec(s.disk.readSec) + " · 写 " + fmtBytesSec(s.disk.writeSec));

    setText("netRx", fmtBytesSec(s.net.rxSec));
    setText("netTx", fmtBytesSec(s.net.txSec));
    const ifaces = (s.net.interfaces || []).map(i => i.iface).filter(Boolean);
    setText("netIfaces", ifaces.length ? "接口 " + ifaces.slice(0, 2).join(", ") : "接口 —");

    setText("uptime", fmtUptime(s.system.uptime));
    setText("hostInfo", (s.system.distro || "") + (s.system.hostname ? " · " + s.system.hostname : ""));

    const body = document.getElementById("procBody");
    if (s.processes && s.processes.length) {
      body.innerHTML = s.processes.map(function (p) {
        const cpuPct = Math.max(0, Math.min(100, p.cpu));
        return (
          '<tr>' +
          '<td class="col-name"><span class="proc-name"><i class="proc-icon"></i><span class="proc-name-text" title="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</span></span></td>' +
          '<td class="col-pid">' + p.pid + '</td>' +
          '<td class="col-cpu">' + p.cpu.toFixed(1) + '%</td>' +
          '<td class="col-mem">' + p.mem.toFixed(1) + '%</td>' +
          '<td class="col-bar"><div class="bar"><i style="width:' + cpuPct + '%"></i></div></td>' +
          '</tr>'
        );
      }).join("");
    } else {
      body.innerHTML = '<tr><td colspan="5" class="empty">暂无进程数据</td></tr>';
    }

    setText("sysCpu", (s.cpu.model || "—") + (s.cpu.cores ? " · " + s.cpu.cores + " 核" : ""));
    setText("sysGpu", (s.system.gpus && s.system.gpus.length) ? s.system.gpus.join(", ") : "—");
    setText("sysOs", s.system.distro || "—");
    setText("sysKernel", s.system.kernel || "—");
    setText("sysArch", s.system.arch || "—");
    setText("sysHost", s.system.hostname || "—");
    const disks = (s.disk.fsList || []).map(function (f) {
      return f.mount + " (" + Math.round(f.percent) + "%)";
    });
    setText("sysDisks", disks.length ? disks.join("  ·  ") : "—");

    drawChart(document.getElementById("cpuChart"), s.cpuHistory, "#3a8dff", "rgba(58,141,255,0.12)", 100);
    drawChart(document.getElementById("memChart"), s.memHistory, "#3a8dff", "rgba(58,141,255,0.12)", 100);
    drawNetChart(document.getElementById("netChart"), s.netRxHistory, s.netTxHistory);
  }

  async function poll() {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      const data = await res.json();
      render(data);
    } catch (e) {}
  }

  poll();
  setInterval(poll, 1500);
  let resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(poll, 200);
  });
})();
