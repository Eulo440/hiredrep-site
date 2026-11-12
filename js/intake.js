(function () {
  var STRIPE_LINK = "https://buy.stripe.com/6oU28q4Pj2nr8fEgHD3ZK00";
  var STRIPE_NO_TRIAL_LINK = "https://buy.stripe.com/3cIaEW1D73rv8fE4YV3ZK01";
  var FORMSUBMIT = "https://formsubmit.co/ajax/john@hiredrep.ai";
  var DEFAULT_API = "http://127.0.0.1:8787/analyze";
  var AGREE_TRIAL = "I understand that HiredRep is an AI-run outbound service, that I will take the meetings it books, and that starting the free month on Stripe requires a card ($0 today, then $100 a month after 30 days unless I cancel before then). I can cancel anytime; no refunds on months already started. HiredRep only emails business contacts in the United States.";
  var AGREE_NO_TRIAL = "I understand that HiredRep is an AI-run outbound service, that I will take the meetings it books, and that starting at $100 a month on Stripe requires a card (charged $100 today, then $100 a month). I can cancel anytime; no refunds on months already started. HiredRep only emails business contacts in the United States.";

  function apiUrl(path) {
    path = path || "/analyze";
    var params = new URLSearchParams(location.search);
    if (params.get("api") && location.hostname !== "hiredrep.ai" && location.hostname !== "www.hiredrep.ai") {
      try {
        var override = new URL(params.get("api"), location.href);
        override.pathname = path;
        return override.toString();
      } catch (e) {
        return params.get("api");
      }
    }
    if (location.hostname === "hiredrep.ai" || location.hostname === "www.hiredrep.ai") {
      return "https://hiredrep-intake.hiredrep.workers.dev" + path;
    }
    try {
      var local = new URL(DEFAULT_API);
      local.pathname = path;
      return local.toString();
    } catch (e) {
      return DEFAULT_API;
    }
  }

  var startForm = document.getElementById("start-form");
  if (!startForm) return;

  var step1 = document.getElementById("step-1");
  var stepReading = document.getElementById("step-reading");
  var step2 = document.getElementById("step-2");
  var stepResult = document.getElementById("step-result");
  var startError = document.getElementById("start-error");
  var intakeForm = document.getElementById("intake-form");
  var resumeToken = "";
  var autosaveTimer = null;
  var lastAutosaveAt = 0;

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

  function isBlockedHost(host) {
    var h = String(host || "").toLowerCase().replace(/^\[|\]$/g, "");
    if (!h) return true;
    if (h === "localhost" || h === "localhost.localdomain" || h === "127.0.0.1" || h === "0.0.0.0" || h === "::1") return true;
    if (h === "metadata.google.internal" || h === "metadata.google.com" || h === "169.254.169.254") return true;
    if (/\.(local|internal|localhost|lan|home|corp)$/.test(h)) return true;
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (m) {
      var o = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      if (o.some(function (n) { return n > 255; })) return true;
      var a = o[0], b = o[1];
      if (a === 0 || a === 10 || a === 127) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 100 && b >= 64 && b <= 127) return true;
      if (a >= 224) return true;
      return true; // no raw IP addresses as company websites
    }
    if (h.indexOf(":") !== -1) return true;
    return false;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeUrl(value) {
    var raw = String(value || "").trim();
    if (!raw) {
      return { ok: false, url: "", error: "Enter a web address like amazon.com or https://amazon.com." };
    }
    if (raw.length > 2048) {
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
    if (parsed.username || parsed.password) {
      return { ok: false, url: "", error: "Enter a web address like amazon.com or https://amazon.com." };
    }
    var host = (parsed.hostname || "").toLowerCase();
    if (!host || host.indexOf(".") === -1 || isBlockedHost(host)) {
      return { ok: false, url: "", error: "Enter a web address like amazon.com or https://amazon.com." };
    }
    parsed.hash = "";
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

  function clearSuggested() {
    Array.prototype.forEach.call(document.querySelectorAll(".field.is-suggested"), function (el) {
      el.classList.remove("is-suggested");
    });
  }

  function markSuggested(ids) {
    clearSuggested();
    (ids || []).forEach(function (id) {
      var input = document.getElementById(id);
      if (!input || !(input.value || "").trim()) return;
      var field = input.closest(".field");
      if (field) field.classList.add("is-suggested");
    });
  }

  function fillDraft(website, email, payload) {
    var draft = (payload && payload.draft) || {};
    var ic = draft.ideal_customers || {};
    var host = domainFromWebsite(payload && payload.website ? payload.website : website);
    setVal("website_found", (payload && payload.website) || website || "");
    setVal("status_email_confirm", email || "");
    setVal("company_name", draft.company_name || "");
    setVal("phone", draft.phone || "");
    setVal("postal_address", draft.address || "");
    setVal("what_you_sell", draft.what_you_sell || "");
    setVal("problem_why_now", draft.problem_why_now || "");
    setVal("ideal_industries", ic.industries || "");
    setVal("ideal_titles", ic.titles || "");
    setVal("ideal_size", ic.size || "");
    setVal("ideal_geo", ic.geo || "");
    setVal("best_customers", Array.isArray(draft.best_customers) ? draft.best_customers.join("\n") : (draft.best_customers || ""));
    setVal("proof_points", Array.isArray(draft.proof_points) ? draft.proof_points.join("\n") : (draft.proof_points || ""));
    setVal("great_fit", draft.great_fit || "");
    setVal("bad_fit", draft.bad_fit || "");
    setVal("suggested_sender_name", draft.suggested_sender_name || "");
    setVal("qualified_meeting", draft.qualified_meeting || "");
    setVal("calendar_link", draft.calendar_link || "");
    setVal("meeting_owner_email", email);
    if (draft.meeting_owner_name) setVal("meeting_owner_name", draft.meeting_owner_name);
    else if (draft.suggested_sender_name) setVal("meeting_owner_name", draft.suggested_sender_name);
    var sendA = document.getElementById("send-label-a");
    var sendB = document.getElementById("send-label-b");
    if (sendA) sendA.textContent = "hiredrep@" + host + " — a mailbox on your own domain (recommended)";
    if (sendB) sendB.textContent = slugFromHost(host) + "@gethiredrep.com — we set it up for you, same day";
    setVal("fit_decision", (draft.fit && draft.fit.decision) || "review");
    setVal("fit_reasons", ((draft.fit && draft.fit.reasons) || []).join(" | "));
    setVal("pages_read", ((payload && payload.pages_read) || []).join("\n"));
    setVal("analyze_source", (payload && payload.source) || "");
    markSuggested(draft.inferred || []);
  }

  function setAgreeCopy(text) {
    var el = document.getElementById("agree-copy");
    if (el) el.textContent = text;
  }

  function applyDecision(decision, reasons, trial) {
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
      setAgreeCopy(AGREE_TRIAL);
      return;
    }
    if (decision === "review") {
      banner.innerHTML = trial === false
        ? "<p>Thanks — we'll confirm within one business day. There is no free month on this signup, and there is no charge now.</p>"
        : "<p>Thanks — we'll confirm within one business day. There is no charge now.</p>";
      submitBtn.textContent = "Send these details";
      payNote.hidden = true;
      agree.required = false;
      setAgreeCopy(AGREE_TRIAL);
      return;
    }
    if (decision === "returning") {
      banner.innerHTML = "<p>This company has already used its free month. You can start HiredRep at $100 a month with no trial.</p>";
      submitBtn.textContent = "Submit and start at $100 a month";
      payNote.hidden = false;
      payNote.textContent = "Card required. You will be charged $100 today, then $100 a month. You can cancel anytime from your account.";
      agree.required = true;
      setAgreeCopy(AGREE_NO_TRIAL);
      return;
    }
    banner.innerHTML = "<p>Here's what we found. Check the details below, fill in anything missing, and start your free month.</p>";
    submitBtn.textContent = "Submit and start your free month";
    payNote.hidden = false;
    payNote.textContent = "Card required. You pay $0 today. Your first $100 charge is on day 31, and you can cancel anytime before then from your account.";
    agree.required = true;
    setAgreeCopy(AGREE_TRIAL);
  }

  function showFallback(website, email, message) {
    var reasons = ["Site reading failed; short form used."];
    fillDraft(website, email, { website: website, draft: { fit: { decision: "review", reasons: reasons } }, source: "fallback" });
    applyDecision("review", reasons);
    var detail = escapeHtml(message || "We could not finish reading that website.");
    document.getElementById("fit-banner").innerHTML =
      "<p>" + detail + " Fill in this form to continue. We'll confirm within one business day. There is no charge now.</p>";
    show(step2);
    savePartial({ website: website, email: email, source: "step1-fallback" });
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


  function setResumeToken(token) {
    resumeToken = token || "";
    var hidden = document.getElementById("resume_token");
    if (hidden) hidden.value = resumeToken;
    if (token && window.history && window.history.replaceState) {
      try {
        var next = new URL(location.href);
        if (next.searchParams.get("resume") !== token) {
          next.searchParams.set("resume", token);
          history.replaceState(null, "", next.pathname + next.search + next.hash);
        }
      } catch (e) { /* ignore */ }
    }
  }

  function currentEmail() {
    return (
      (document.getElementById("status_email_confirm") && document.getElementById("status_email_confirm").value) ||
      (document.getElementById("status_email") && document.getElementById("status_email").value) ||
      ""
    ).trim();
  }

  function currentWebsite() {
    return (
      (document.getElementById("website_found") && document.getElementById("website_found").value) ||
      (document.getElementById("website") && document.getElementById("website").value) ||
      ""
    ).trim();
  }

  function collectFields() {
    var data = {};
    if (!intakeForm) return data;
    Array.prototype.forEach.call(intakeForm.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.name === "agree_service" || el.name === "resume_token") return;
      if ((el.type === "radio" || el.type === "checkbox") && !el.checked) return;
      data[el.name] = el.value;
    });
    return data;
  }

  function savePartial(extra) {
    extra = extra || {};
    var website = extra.website || currentWebsite();
    var email = extra.email || currentEmail();
    if (!website || !email) return Promise.resolve(null);
    var body = {
      token: resumeToken || extra.token || "",
      website: website,
      email: email,
      fields: extra.fields || collectFields(),
      source: extra.source || "autosave",
    };
    if (extra.prefill) body.prefill = extra.prefill;
    return fetch(apiUrl("/partial"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: body.source === "autosave",
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return data && typeof data === "object" ? data : null;
        }).catch(function () { return null; });
      })
      .then(function (data) {
        if (data && data.ok && data.token) setResumeToken(data.token);
        lastAutosaveAt = Date.now();
        return data;
      })
      .catch(function () { return null; });
  }

  function scheduleAutosave() {
    if (step2.classList.contains("intake-hidden")) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () {
      savePartial({ source: "autosave" });
    }, 20000);
  }

  function applyResumePayload(payload) {
    var email = payload.email || "";
    var website = payload.website || "";
    var startWebsite = document.getElementById("website");
    var startEmail = document.getElementById("status_email");
    if (startWebsite && website) startWebsite.value = website;
    if (startEmail && email) startEmail.value = email;
    fillDraft(website, email, {
      website: website,
      draft: payload.prefill || {},
      source: (payload.fields && payload.fields.analyze_source) || "resume",
    });
    var fields = payload.fields || {};
    Object.keys(fields).forEach(function (name) {
      var nodes = intakeForm.querySelectorAll("[name='" + name + "']");
      if (!nodes.length) {
        var byId = document.getElementById(name);
        if (byId) byId.value = fields[name];
        return;
      }
      Array.prototype.forEach.call(nodes, function (el) {
        if (el.type === "radio") {
          el.checked = el.value === fields[name];
        } else if (el.type === "checkbox") {
          el.checked = fields[name] === el.value || fields[name] === "yes";
        } else {
          el.value = fields[name];
        }
      });
    });
    var decision = (fields.fit_decision) || (payload.prefill && payload.prefill.fit && payload.prefill.fit.decision) || "review";
    var reasons = fields.fit_reasons ? String(fields.fit_reasons).split(" | ") : ((payload.prefill && payload.prefill.fit && payload.prefill.fit.reasons) || []);
    var trial = payload.prefill && payload.prefill.fit ? payload.prefill.fit.trial : undefined;
    applyDecision(decision, reasons, trial);
  }

  function tryResume() {
    var params = new URLSearchParams(location.search);
    var token = (params.get("resume") || "").trim();
    if (!token) return false;
    show(stepReading);
    fetch(apiUrl("/partial") + (apiUrl("/partial").indexOf("?") >= 0 ? "&" : "?") + "token=" + encodeURIComponent(token))
      .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
      .then(function (out) {
        if (!out.data || !out.data.ok) {
          setError(startError, "We could not find that saved form. Enter your website and email to start again.");
          show(step1);
          return;
        }
        setResumeToken(out.data.token || token);
        if (out.data.status === "complete") {
          document.getElementById("result-title").textContent = "We already have your intake.";
          document.getElementById("result-body").textContent =
            "Thanks — your HiredRep onboarding details are already saved. If you have questions, email john@hiredrep.ai.";
          show(stepResult);
          return;
        }
        applyResumePayload(out.data);
        show(step2);
      })
      .catch(function () {
        setError(startError, "We could not load your saved form. Enter your website and email to start again.");
        show(step1);
      });
    return true;
  }

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
    fetch(apiUrl("/analyze"), {
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
        if (out.data.resume_token) setResumeToken(out.data.resume_token);
        fillDraft(website, email, out.data);
        var decision = (out.data.draft && out.data.draft.fit && out.data.draft.fit.decision) || "review";
        var reasons = (out.data.draft && out.data.draft.fit && out.data.draft.fit.reasons) || [];
        var trial = out.data.draft && out.data.draft.fit ? out.data.draft.fit.trial : undefined;
        applyDecision(decision, reasons, trial);
        show(step2);
        savePartial({ website: website, email: email, prefill: out.data.draft || null, source: "step1" });
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
    var decision = data.fit_decision || "review";
    var company = data.company_name || "unknown";
    data._subject = "HiredRep intake: " + decision + ": " + company;
    if (data.status_email && !data._replyto) data._replyto = data.status_email;
    if (resumeToken) data.resume_token = resumeToken;
    return data;
  }

  function saveIntake(data) {
    return fetch(apiUrl("/intake"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(function (res) {
      return res.json().then(function (body) {
        return body && typeof body === "object" ? body : { ok: false };
      }).catch(function () { return { ok: false }; });
    }).catch(function () {
      return { ok: false };
    });
  }

  function notifyJohn(data) {
    // Fire-and-forget so Formsubmit never delays the Stripe redirect.
    try {
      fetch(FORMSUBMIT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
        keepalive: true,
      }).catch(function () { return null; });
    } catch (e) { /* ignore */ }
  }

  function showSavedResult(decision) {
    document.getElementById("result-title").textContent =
      decision === "decline" ? "Thank you for considering HiredRep." : "We'll confirm within one business day.";
    document.getElementById("result-body").textContent =
      decision === "decline"
        ? "HiredRep is not the right fit in this case, so we have not started a free month or taken a card. If you have questions, email john@hiredrep.ai."
        : "We received your details and will email you from john@hiredrep.ai within one business day. There is no charge now.";
    show(stepResult);
  }

  var submitting = false;
  intakeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (submitting) return;
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
    submitting = true;
    submitBtn.disabled = true;

    notifyJohn(data);

    saveIntake(data).then(function (saved) {
      if (!saved || !saved.ok) {
        setError(err, "We could not save your details just now. Please email john@hiredrep.ai or try again.");
        submitting = false;
        submitBtn.disabled = false;
        return;
      }
      if (decision === "accept" || decision === "returning") {
        var already = saved.already;
        var link = decision === "returning" || already ? STRIPE_NO_TRIAL_LINK : STRIPE_LINK;
        window.location.href = link;
        return;
      }
      showSavedResult(decision);
      submitting = false;
      submitBtn.disabled = false;
    });
  });

  if (intakeForm) {
    intakeForm.addEventListener("blur", function (event) {
      if (!event.target || !event.target.name) return;
      if (step2.classList.contains("intake-hidden")) return;
      if (autosaveTimer) clearTimeout(autosaveTimer);
      savePartial({ source: "blur" });
    }, true);
    intakeForm.addEventListener("input", scheduleAutosave);
    intakeForm.addEventListener("change", scheduleAutosave);
  }
  setInterval(function () {
    if (step2.classList.contains("intake-hidden")) return;
    if (Date.now() - lastAutosaveAt < 20000) return;
    savePartial({ source: "interval" });
  }, 20000);

  tryResume();
})();
