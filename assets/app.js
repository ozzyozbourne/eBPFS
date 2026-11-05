// Shared behavior for every chapter: theme toggle, table of contents, copy buttons,
// quizzes, tabs, and steppers. Chapters need no inline JS for these widgets.
(function () {
  const root = document.documentElement;
  if (localStorage.getItem("ebpf-theme") === "light") root.classList.add("light");

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.addEventListener("click", () => {
      root.classList.toggle("light");
      localStorage.setItem("ebpf-theme", root.classList.contains("light") ? "light" : "dark");
    });

    // Table of contents from h2/h3 inside <main>.
    const toc = document.querySelector("nav.toc");
    const heads = [...document.querySelectorAll("main h2, main h3")];
    if (toc) {
      const title = document.createElement("div");
      title.className = "toc-title"; title.textContent = "On this page";
      toc.appendChild(title);
      heads.forEach((h, i) => {
        if (!h.id) h.id = h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "s" + i;
        const a = document.createElement("a");
        a.href = "#" + h.id; a.textContent = h.textContent; a.className = h.tagName.toLowerCase();
        toc.appendChild(a);
      });
      const links = [...toc.querySelectorAll("a")];
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) links.forEach((l) => l.classList.toggle("active", l.hash === "#" + e.target.id));
        });
      }, { rootMargin: "0px 0px -75% 0px" });
      heads.forEach((h) => obs.observe(h));
    }

    // Copy buttons on code blocks.
    document.querySelectorAll("pre").forEach((pre) => {
      const b = document.createElement("button");
      b.className = "copy"; b.textContent = "copy";
      b.addEventListener("click", () => {
        navigator.clipboard.writeText(pre.querySelector("code")?.innerText ?? pre.innerText);
        b.textContent = "copied"; setTimeout(() => (b.textContent = "copy"), 1200);
      });
      pre.appendChild(b);
    });

    // Quizzes: <div class="q"><p>..</p><button class="opt" data-right>..</button>..<div class="why">..</div></div>
    document.querySelectorAll(".quiz .q").forEach((q) => {
      q.querySelectorAll("button.opt").forEach((o) => o.addEventListener("click", () => {
        if (q.classList.contains("answered")) return;
        q.classList.add("answered");
        q.querySelectorAll("button.opt").forEach((x) => { if (x.hasAttribute("data-right")) x.classList.add("right"); });
        if (!o.hasAttribute("data-right")) o.classList.add("wrong");
      }));
    });

    // Tabs: <div class="tabs"><div class="tab-panel" data-label="C">..</div>...</div>
    document.querySelectorAll(".tabs").forEach((t) => {
      const panels = [...t.querySelectorAll(":scope > .tab-panel")];
      const bar = document.createElement("div"); bar.className = "tab-bar";
      panels.forEach((p, i) => {
        const b = document.createElement("button"); b.textContent = p.dataset.label || "Tab " + (i + 1);
        b.addEventListener("click", () => {
          panels.forEach((x) => x.classList.remove("active"));
          bar.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
          p.classList.add("active"); b.classList.add("active");
        });
        bar.appendChild(b);
        if (i === 0) { p.classList.add("active"); b.classList.add("active"); }
      });
      t.prepend(bar);
    });

    // Steppers: <div class="stepper"><div class="step">..</div>...</div>
    document.querySelectorAll(".stepper").forEach((s) => {
      const steps = [...s.querySelectorAll(":scope > .step")];
      let i = 0;
      const c = document.createElement("div"); c.className = "controls";
      c.innerHTML = '<button data-d="-1">&larr; Prev</button><button data-d="1">Next &rarr;</button><span class="count"></span>';
      const show = () => {
        steps.forEach((x, j) => x.classList.toggle("active", j === i));
        c.querySelector(".count").textContent = `Step ${i + 1} / ${steps.length}`;
      };
      c.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        i = Math.max(0, Math.min(steps.length - 1, i + Number(b.dataset.d))); show();
      }));
      s.appendChild(c); show();
    });

    if (window.hljs) window.hljs.highlightAll();
  });
})();
