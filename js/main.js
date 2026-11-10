(function () {
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  function setOpen(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(false);
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });
  }

  if (header) {
    var update = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
  }
})();


(function () {
  var params = new URLSearchParams(window.location.search);
  var paid = params.get("paid") === "1" || params.get("paid") === "true";
  var sessionId = params.get("session_id") || "";
  if (!/^[a-zA-Z0-9_]+$/.test(sessionId)) sessionId = "";

  document.body.classList.toggle("is-paid", paid);

  var intake = document.getElementById("welcome-intake");
  if (intake && sessionId) {
    intake.setAttribute("href", "signup.html?paid=1&session_id=" + encodeURIComponent(sessionId));
  }

  var form = document.getElementById("intake-form");
  if (form && (paid || sessionId)) {
    var eyebrow = document.querySelector(".page-hero .eyebrow");
    var heading = document.querySelector(".page-hero h1");
    var lede = document.querySelector(".page-hero .lede");
    if (eyebrow) eyebrow.textContent = "You're in";
    if (heading) heading.textContent = "Now tell us who to reach.";
    if (lede) {
      lede.textContent = "Your free month has started — card on file, $0 today. This intake takes about ten to fifteen minutes and is how HiredRep knows who to email for you.";
    }

    var notice = document.querySelector(".notice");
    if (notice) {
      notice.innerHTML = "<p><strong>Your free month has started.</strong> Submit this intake so we can begin. If you already sent it, you do not need to send it again — John will email you from <a href=\"mailto:john@hiredrep.ai\">john@hiredrep.ai</a>.</p>";
    }

    var next = form.querySelector("input[name='_next']");
    if (next) next.value = "https://hiredrep.ai/thanks.html?paid=1";
    var subject = form.querySelector("input[name='_subject']");
    if (subject) subject.value = "New HiredRep sign-up (paid)";

    function ensureHidden(name, value) {
      var existing = form.querySelector("input[name='" + name + "']");
      if (!existing) {
        existing = document.createElement("input");
        existing.type = "hidden";
        existing.name = name;
        form.appendChild(existing);
      }
      existing.value = value;
    }
    ensureHidden("paid", "1");
    if (sessionId) ensureHidden("checkout_session_id", sessionId);

    var fine = document.getElementById("intake-fine-print");
    if (fine) {
      fine.innerHTML = 'Questions? <a href="mailto:john@hiredrep.ai">john@hiredrep.ai</a>';
    }
  }
})();
