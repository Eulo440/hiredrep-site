(function () {
  var STRIPE_LINK = "https://buy.stripe.com/6oU28q4Pj2nr8fEgHD3ZK00";
  var FORMSUBMIT = "https://formsubmit.co/ajax/john@hiredrep.ai";
  var DEFAULT_API = "http://127.0.0.1:8787/analyze";

  function apiUrl() {
    var params = new URLSearchParams(location.search);
    if (params.get("api")) return params.get("api");
    if (location.hostname === "hiredrep.ai" || location.hostname === "www.hiredrep.ai") {
      return "https://hiredrep-intake.hiredrep.workers.dev/analyze";
    }
    return DEFAULT_API;
  }

  var startForm = document.getElementById("start-form");
  if (!startForm) return;

  var step1 = document.getElementById("step-1");
  var stepReading = document.getElementById("step-reading");
  var step2 = document.getElementById("step-2");
  var stepResult = document.getElementById("step-result");
  var startError = document.getElementById("start-error");
  var intakeForm = document.getElementById("intake-form");

  function show(el) {
    [step1, stepReading, step2, stepResult].forEach(function (n) {
      n.classList.toggle("intake-hidden", n !== el);
    });
  }

  function setError(node, message) {
    if (!node) return;
    if (!message) {
      node.hidden = true;
      node.textContent = "";
      return;
    }
    node.hidden = false;
    node.textContent = message;
  }

  function normalizeUrl(value) {
    var raw = String(value || "").trim();
    if (!raw) {
      return { ok: false, url: "", error: "Enter a web address like amazon.com or https://amazon.com." };
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = "https://" + raw;
    var parsed;
    try {
      parsed = new URL(raw);
    } catch (err) {
      return { ok: false, url: "", error: "Enter a web address like amazon.com or https://amazon.com." };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, url: "", error: "Enter a web address like amazon.com or https://amazon.com." };
    }
    var host = (parsed.hostname || "").toLowerCase();
    if (!host || host.indexOf(".") === -1) {
      return { ok: false, url: "", error: "Enter a web address like amazon.com or https://amazon.com." };
    }
    return { ok: true, url: parsed.toString(), error: "" };
  }

  function applyNormalizedUrl(input, options) {
    options = options || {};
    var raw = (input.value || "").trim();
    if (!raw) {
      input.setCustomValidity(options.required ? "Enter a web address like amazon.com or https://amazon.com." : "");
      if (options.errorNode && options.required) setError(options.errorNode, "Enter a web address like amazon.com or https://amazon.com.");
      else if (options.errorNode) setError(options.errorNode, "");
      return "";
    }
    var out = normalizeUrl(raw);
    if (out.ok) {
      input.value = out.url;
      input.setCustomValidity("");
      if (options.errorNode) setError(options.errorNode, "");
      return out.url;
    }
    input.setCustomValidity(out.error);
    if (options.errorNode) setError(options.errorNode, out.error);
    return "";
  }

  function domainFromWebsite(website) {
    try {
      var host = new URL(website).hostname.replace(/^www\./, "");
      return host || "yourdomain.com";
    } catch (e) {
      return "yourdomain.com";
    }
  }

  function slugFromHost(host) {
    var parts = String(host || "").split(".");
    return (parts.length >= 2 ? parts[0] : host).replace(/[^a-z0-9]/gi, "").toLowerCase() || "yourcompany";
  }

  function setVal(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value == null ? "" : value;
  }

  function fillDraft(website, email, payload) {
    var draft = (payload && payload.draft) || {};
    var ic = draft.ideal_customers || {};
    var host = domainFromWebsite(payload && payload.website ? payload.website : website);
    setVal("website_found", (payload && payload.website) || website);
    setVal("status_email_confirm", email);
    setVal("company_name", draft.company_name || "");
    setVal("phone", draft.phone || "");
    setVal("postal_address", draft.address || "");
    setVal("what_you_sell", draft.what_you_sell || "");
    setVal("problem_why_now", draft.problem_why_now || "");
    setVal("ideal_industries", ic.industries || "");
    setVal("ideal_titles", ic.titles || "");
    setVal("ideal_size", ic.size || "");
    setVal("ideal_geo", ic.geo || "");
    setVal("best_customers", draft.best_customers || "");
    setVal("proof_points", (draft.proof_points || []).join("\n"));
    setVal("tone", draft.tone || "");
    setVal("suggested_sender_name", draft.suggested_sender_name || "");
    setVal("qualified_meeting", draft.qualified_meeting || "");
    setVal("meeting_owner_email", email);
    if (draft.suggested_sender_name) setVal("meeting_owner_name", draft.suggested_sender_name);
    var sendA = document.getElementById("send-label-a");
    var sendB = document.getElementById("send-label-b");
    if (sendA) sendA.textContent = "hiredrep@" + host + " — a mailbox on your own domain (recommended)";
    if (sendB) sendB.textContent = slugFromHost(host) + "@gethiredrep.com — we set it up for you, same day";
    setVal("fit_decision", (draft.fit && draft.fit.decision) || "review");
    setVal("fit_reasons", ((draft.fit && draft.fit.reasons) || []).join(" | "));
    setVal("pages_read", ((payload && payload.pages_read) || []).join("\n"));
    setVal("analyze_source", (payload && payload.source) || "");
  }

  function applyDecision(decision, reasons) {
    var banner = document.getElementById("fit-banner");
    var submitBtn = document.getElementById("submit-btn");
    var payNote = document.getElementById("pay-note");
    var agree = document.getElementById("agree_service");
    reasons = reasons || [];
    if (decision === "decline") {
      banner.innerHTML = "<p>HiredRep is not a fit for this company, so we will not start a free month or take a card.</p>";
      submitBtn.textContent = "Send this note";
      payNote.hidden = true;
      agree.required = false;
      return;
    }
    if (decision === "review") {
      banner.innerHTML = "<p>Thanks — we'll confirm within one business day. There is no charge now.</p>";
      submitBtn.textContent = "Send these details";
      payNote.hidden = true;
      agree.required = false;
      return;
    }
    banner.innerHTML = "<p>We can take this from here. Confirm the details below and start your free month.</p>";
    submitBtn.textContent = "Submit and start your free month";
    payNote.hidden = false;
    agree.required = true;
  }

  function showFallback(website, email, message) {
    fillDraft(website, email, { website: website, draft: { fit: { decision: "review", reasons: ["Site reading failed; short form used."] } }, source: "fallback" });
    applyDecision("accept", []);
    document.getElementById("fit-banner").innerHTML =
      "<p>" + (message || "We could not finish setup.") + " Fill in this form to continue.</p>";
    document.getElementById("fit_decision").value = "accept";
    document.getElementById("submit-btn").textContent = "Submit and start your free month";
    document.getElementById("pay-note").hidden = false;
    document.getElementById("agree_service").required = true;
    show(step2);
  }

  ["website", "website_found", "calendar_link"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("blur", function () {
      var required = el.hasAttribute("required");
      var errorNode = id === "website" ? startError : document.getElementById("submit-error");
      if (!(el.value || "").trim()) {
        el.setCustomValidity(required ? "Enter a web address like amazon.com or https://amazon.com." : "");
        if (id === "website") setError(startError, "");
        return;
      }
      applyNormalizedUrl(el, { required: required, errorNode: errorNode });
    });
  });

  startForm.addEventListener("submit", function (event) {
    event.preventDefault();
    setError(startError, "");
    var websiteInput = document.getElementById("website");
    var email = (document.getElementById("status_email").value || "").trim();
    var website = applyNormalizedUrl(websiteInput, { required: true, errorNode: startError });
    if (!website) {
      if (websiteInput.reportValidity) websiteInput.reportValidity();
      return;
    }
    if (!email) {
      setError(startError, "Enter your website and email.");
      return;
    }
    show(stepReading);
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 25000);
    fetch(apiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website: website, email: email }),
      signal: controller.signal,
    })
      .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
      .then(function (out) {
        clearTimeout(timer);
        if (!out.data || !out.data.ok) {
          showFallback(website, email, (out.data && out.data.error) || "We could not finish setup.");
          return;
        }
        fillDraft(website, email, out.data);
        var decision = (out.data.draft && out.data.draft.fit && out.data.draft.fit.decision) || "review";
        var reasons = (out.data.draft && out.data.draft.fit && out.data.draft.fit.reasons) || [];
        applyDecision(decision, reasons);
        show(step2);
      })
      .catch(function () {
        clearTimeout(timer);
        showFallback(website, email, "We could not finish setup.");
      });
  });

  function collectPayload() {
    var data = {};
    Array.prototype.forEach.call(intakeForm.elements, function (el) {
      if (!el.name || el.disabled) return;
      if ((el.type === "radio" || el.type === "checkbox") && !el.checked) return;
      data[el.name] = el.value;
    });
    data._subject = "New HiredRep sign-up (" + (data.fit_decision || "unknown") + ")";
    return data;
  }

  function notifyJohn(data) {
    return fetch(FORMSUBMIT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    }).catch(function () { return null; });
  }

  intakeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var err = document.getElementById("submit-error");
    setError(err, "");
    var calendarInput = document.getElementById("calendar_link");
    var foundInput = document.getElementById("website_found");
    if (!applyNormalizedUrl(calendarInput, { required: true, errorNode: err })) {
      if (calendarInput.reportValidity) calendarInput.reportValidity();
      return;
    }
    if ((foundInput.value || "").trim() && !applyNormalizedUrl(foundInput, { required: false, errorNode: err })) {
      if (foundInput.reportValidity) foundInput.reportValidity();
      return;
    }
    if (!intakeForm.reportValidity()) return;
    var decision = document.getElementById("fit_decision").value || "review";
    var data = collectPayload();
    var submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = true;

    if (decision === "accept") {
      notifyJohn(data);
      window.location.href = STRIPE_LINK;
      return;
    }

    notifyJohn(data).then(function () {
      document.getElementById("result-title").textContent =
        decision === "decline" ? "Thank you for considering HiredRep." : "We'll confirm within one business day.";
      document.getElementById("result-body").textContent =
        decision === "decline"
          ? "HiredRep is not the right fit in this case, so we have not started a free month or taken a card. If you have questions, email john@hiredrep.ai."
          : "We received your details and will email you from john@hiredrep.ai within one business day. There is no charge now.";
      show(stepResult);
      submitBtn.disabled = false;
    }).catch(function () {
      setError(err, "We could not send that just now. Please email john@hiredrep.ai.");
      submitBtn.disabled = false;
    });
  });
})();
