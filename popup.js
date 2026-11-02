(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const expressionEl = $("#expression"), resultEl = $("#result"), statusEl = $("#status");
  const historyList = $("#historyList"), historyCount = $("#historyCount"), scientificKeys = $("#scientificKeys");
  let expression = "", lastAnswer = 0, justEvaluated = false, mode = "standard", angle = "DEG", history = [], toastTimer;
  const VARA_METRES = 0.835905;
  const SQ_METRES_PER_ACRE = 4046.8564224;
  const SQ_FEET_PER_ACRE = 43560;

  const storageGet = (keys) => new Promise(resolve => { try { chrome.storage.local.get(keys, resolve); } catch { resolve({}); } });
  const storageSet = (obj) => new Promise(resolve => { try { chrome.storage.local.set(obj, resolve); } catch { resolve(); } });
  function showToast(message) {
    const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 1400);
  }
  function pretty(n) {
    if (!Number.isFinite(n)) throw new Error("Result is not a finite number");
    if (Object.is(n, -0)) n = 0;
    if (Math.abs(n) >= 1e12 || (Math.abs(n) > 0 && Math.abs(n) < 1e-7)) return n.toExponential(7).replace(/\.?0+e/, "e");
    return Number(n.toPrecision(12)).toLocaleString("en-US", { maximumFractionDigits: 10, useGrouping: false });
  }
  const normalize = (source) => source.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/π/g, "PI");
  function factorial(n) {
    if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error("Factorial needs an integer from 0 to 170");
    let value = 1; for (let i = 2; i <= n; i++) value *= i; return value;
  }
  function calculate(source) {
    let s = normalize(source).replace(/\s+/g, ""); if (!s) return 0;
    s = s.replace(/(\d|\))%/g, "$1/100");
    const tokens = s.match(/(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|(?:PI|ANS|sin|cos|tan|asin|acos|atan|sqrt|log|ln|abs|fact)|[a-z]+|[()+\-*/^!,]/gi);
    if (!tokens || tokens.join("") !== s) throw new Error("Invalid expression");
    let i = 0; const peek = () => tokens[i]; const take = () => tokens[i++];
    const isNum = t => t && /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(t);
    const toRad = x => angle === "DEG" ? x * Math.PI / 180 : x;
    const fromRad = x => angle === "DEG" ? x * 180 / Math.PI : x;
    function primary() {
      const t = take(); if (t === undefined) throw new Error("Incomplete expression");
      if (t === "+") return unary(); if (t === "-") return -unary();
      if (t === "(") { const v = addSub(); if (take() !== ")") throw new Error("Missing )"); return v; }
      if (isNum(t)) return Number(t); if (/^PI$/i.test(t)) return Math.PI; if (/^ANS$/i.test(t)) return lastAnswer;
      const fn = t.toLowerCase();
      if (["sin","cos","tan","asin","acos","atan","sqrt","log","ln","abs","fact"].includes(fn)) {
        let x; if (peek() === "(") { take(); x = addSub(); if (take() !== ")") throw new Error("Missing )"); } else x = primary();
        switch (fn) {
          case "sin": return Math.sin(toRad(x)); case "cos": return Math.cos(toRad(x)); case "tan": return Math.tan(toRad(x));
          case "asin": return fromRad(Math.asin(x)); case "acos": return fromRad(Math.acos(x)); case "atan": return fromRad(Math.atan(x));
          case "sqrt": if (x < 0) throw new Error("Invalid square root"); return Math.sqrt(x);
          case "log": if (x <= 0) throw new Error("Log requires a positive number"); return Math.log10(x);
          case "ln": if (x <= 0) throw new Error("Ln requires a positive number"); return Math.log(x);
          case "abs": return Math.abs(x); case "fact": return factorial(x);
        }
      }
      throw new Error("Invalid expression");
    }
    function postfix() { let v = primary(); while (peek() === "!") { take(); v = factorial(v); } return v; }
    function power() { let a = postfix(); if (peek() === "^") { take(); a = Math.pow(a, unary()); } return a; }
    function unary() { if (peek() === "+") { take(); return unary(); } if (peek() === "-") { take(); return -unary(); } return power(); }
    function mulDiv() { let v = unary(); while (peek() === "*" || peek() === "/") { const op = take(), b = unary(); if (op === "/" && b === 0) throw new Error("Cannot divide by zero"); v = op === "*" ? v * b : v / b; } return v; }
    function addSub() { let v = mulDiv(); while (peek() === "+" || peek() === "-") { const op = take(), b = mulDiv(); v = op === "+" ? v + b : v - b; } return v; }
    const value = addSub(); if (i < tokens.length) throw new Error("Invalid expression"); if (!Number.isFinite(value)) throw new Error("Result is out of range"); return value;
  }
  function updateDisplay(preview = true) {
    expressionEl.textContent = expression || "";
    if (!expression) { resultEl.textContent = "0"; statusEl.textContent = "Ready"; return; }
    if (preview && !justEvaluated) { try { resultEl.textContent = pretty(calculate(expression)); statusEl.textContent = "Preview"; } catch { resultEl.textContent = "—"; statusEl.textContent = "Enter expression"; } }
  }
  function append(value) { if (justEvaluated && /[0-9.(π]/.test(value)) expression = ""; justEvaluated = false; expression += value; updateDisplay(); }
  function insertFunction(fn) {
    const map = { square:"^2", reciprocal:"^(-1)", factorial:"!", sin:"sin(", cos:"cos(", tan:"tan(", asin:"asin(", acos:"acos(", atan:"atan(", sqrt:"sqrt(", log:"log(", ln:"ln(", abs:"abs(" };
    if (fn === "pi") return append("π"); if (fn === "e") return append("2.718281828459045");
    if (["square","reciprocal","factorial"].includes(fn)) { if (!expression) expression = "ANS"; expression += map[fn]; }
    else expression += map[fn] || "";
    justEvaluated = false; updateDisplay();
  }
  async function addHistory(item) { history.unshift(item); history = history.slice(0, 100); await storageSet({ history, lastAnswer }); renderHistory(); }
  async function doEquals() {
    try {
      const value = calculate(expression); lastAnswer = value; const result = pretty(value); resultEl.textContent = result; statusEl.textContent = "Calculated"; justEvaluated = true;
      await addHistory({ kind:"calculator", expression, result, time:Date.now() }); await storageSet({ lastAnswer });
    } catch (error) { statusEl.textContent = error.message || "Check expression"; showToast(statusEl.textContent); }
  }
  function renderHistory() {
    historyList.replaceChildren(); historyCount.textContent = `${history.length} item${history.length === 1 ? "" : "s"}`;
    if (!history.length) { const empty = document.createElement("div"); empty.className = "empty-history"; empty.innerHTML = "<span>◷</span><strong>No calculations yet</strong><p>Your results will appear here.</p>"; historyList.append(empty); return; }
    history.forEach(item => {
      const card = document.createElement("div"); card.className = "history-item"; card.tabIndex = 0;
      const expr = document.createElement("div"); expr.className = "history-expr"; expr.textContent = item.expression;
      const result = document.createElement("div"); result.className = "history-result"; result.textContent = item.result;
      const time = document.createElement("div"); time.className = "history-time"; time.textContent = new Date(item.time).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
      card.append(expr, result, time);
      const restore = () => { if (item.kind === "calculator") { setMode("standard"); expression = item.expression; justEvaluated = false; updateDisplay(); } else { setMode("converter"); showToast("Saved converter result: " + item.result); } };
      card.addEventListener("click", restore); card.addEventListener("keydown", event => { if (event.key === "Enter") restore(); }); historyList.append(card);
    });
  }
  async function setMode(next) {
    mode = next; $$(".mode").forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
    const converter = mode === "converter";
    $("#calculatorView").classList.toggle("hidden", converter); $("#converterView").classList.toggle("hidden", !converter);
    scientificKeys.classList.toggle("hidden", mode !== "scientific"); await storageSet({ mode });
  }

  // Converter dropdown options and compact inputs.
  function configureConverter() {
    const type = $("#converterType").value, dimensions = $("#feetDimensions").value;
    $("#feetOptions").classList.toggle("hidden", type !== "feet");
    const count = type === "sqft" ? 1 : (type === "vara" ? 4 : Number(dimensions));
    [1,2,3,4].forEach(i => { $("#field"+i).classList.toggle("hidden", i > count); });
    const labels = type === "vara" ? ["Length 1 (varas)","Width 1 (varas)","Length 2 (varas)","Width 2 (varas)"] : ["Length 1 (ft)","Width 1 (ft)","Length 2 (ft)","Width 2 (ft)"];
    labels.forEach((label, i) => $("#label"+(i+1)).textContent = label);
    $("#field1 span").textContent = type === "sqft" ? "Area (sq ft)" : labels[0];
    $("#converterHint").textContent = type === "sqft" ? "Acres = square feet ÷ 43,560." : type === "vara" ? "Two rectangles: (L₁ × W₁ + L₂ × W₂) × 0.835905² ÷ 4,046.8564224." : dimensions === "4" ? "Acres = (L₁ × W₁ + L₂ × W₂) ÷ 43,560." : "Acres = length × width ÷ 43,560.";
    $("#varaNote").classList.toggle("hidden", type !== "vara"); calculateConverter();
  }
  function roundedAcres(n) { return (Math.round((n + Number.EPSILON) * 1000) / 1000).toFixed(3); }
  function calculateConverter() {
    const type = $("#converterType").value, count = type === "sqft" ? 1 : (type === "vara" ? 4 : Number($("#feetDimensions").value));
    const inputs = Array.from({length:count}, (_, i) => $("#measure"+(i+1)).value.trim());
    if (inputs.some(value => value === "")) { $("#acreResult").innerHTML = "0.000 <small>acres</small>"; $("#acreResultSub").textContent = "Enter all required measurements."; return null; }
    const values = inputs.map(Number);
    if (values.some(value => !Number.isFinite(value) || value < 0)) { $("#acreResult").innerHTML = "— <small>acres</small>"; $("#acreResultSub").textContent = "Use valid, non-negative numbers."; return null; }
    if (values.every(value => value === 0)) { $("#acreResult").innerHTML = "0.000 <small>acres</small>"; $("#acreResultSub").textContent = "Enter measurements greater than zero."; return null; }
    let area, unit;
    if (type === "sqft") { area = values[0]; unit = "sq ft"; }
    else if (type === "vara") { area = (values[0]*values[1] + values[2]*values[3]) * VARA_METRES * VARA_METRES; unit = "square metres (converted from varas)"; }
    else { area = count === 4 ? values[0]*values[1] + values[2]*values[3] : values[0]*values[1]; unit = "sq ft"; }
    const acres = type === "vara" ? area / SQ_METRES_PER_ACRE : area / SQ_FEET_PER_ACRE;
    if (!Number.isFinite(acres)) { $("#acreResult").innerHTML = "— <small>acres</small>"; $("#acreResultSub").textContent = "Result is too large."; return null; }
    const display = roundedAcres(acres); $("#acreResult").innerHTML = `${display} <small>acres</small>`;
    $("#acreResultSub").textContent = type === "vara" ? `${pretty(area)} ${unit} before conversion.` : `${pretty(area)} ${unit} ÷ ${type === "sqft" || type === "feet" ? "43,560" : "43,560"}.`;
    return { display, acres, area, type, count, values };
  }
  function clearConverter() { [1,2,3,4].forEach(i => $("#measure"+i).value = ""); calculateConverter(); $("#measure1").focus(); }
  async function saveConversion() {
    const data = calculateConverter(); if (!data) { showToast("Enter valid measurements first"); return; }
    const label = data.type === "sqft" ? `${data.values[0]} sq ft → acres` : data.type === "vara" ? `Varas ${data.values.join(" × ")} → acres` : `Feet ${data.values.join(" × ")} → acres`;
    await addHistory({kind:"converter", expression:label, result:`${data.display} acres`, time:Date.now()}); showToast("Conversion saved to history");
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); showToast("Copied to clipboard"); }
    catch { const input = document.createElement("textarea"); input.value = text; document.body.append(input); input.select(); const ok = document.execCommand("copy"); input.remove(); showToast(ok ? "Copied to clipboard" : "Copy not available"); }
  }
  async function updateF1Button() {
    const data = await storageGet(["f1GuardEnabled"]), enabled = data.f1GuardEnabled !== false, button = $("#f1GuardBtn");
    button.classList.toggle("guard-on", enabled); button.classList.toggle("guard-off", !enabled);
    button.textContent = enabled ? "F1 ✓" : "F1 ⏸"; button.title = enabled ? "F1 guard active — click to pause" : "F1 guard paused — click to resume";
    button.setAttribute("aria-label", button.title);
  }

  $$(".keypad button").forEach(button => button.addEventListener("click", () => {
    const {value, action} = button.dataset;
    if (value !== undefined) append(value);
    else if (action === "clear") { expression = ""; justEvaluated = false; updateDisplay(false); }
    else if (action === "backspace") { expression = justEvaluated ? "" : expression.slice(0,-1); justEvaluated = false; updateDisplay(); }
    else if (action === "equals") doEquals(); else if (action === "sign") { expression = expression ? `-(${expression})` : "-"; justEvaluated = false; updateDisplay(); }
    else if (action === "ans") append("ANS"); else if (action === "copy") copyText(resultEl.textContent);
  }));
  $$("#scientificKeys [data-fn]").forEach(button => button.addEventListener("click", () => insertFunction(button.dataset.fn)));
  $$(".mode").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
  $("#angleToggle").addEventListener("click", async () => { angle = angle === "DEG" ? "RAD" : "DEG"; $("#angleLabel").textContent = angle; await storageSet({angle}); updateDisplay(); showToast(`Angle mode: ${angle}`); });
  $("#themeBtn").addEventListener("click", async () => { document.body.classList.toggle("light"); await storageSet({theme:document.body.classList.contains("light") ? "light" : "dark"}); });
  $("#historyToggle").addEventListener("click", () => { $("#historyPanel").classList.toggle("history-hidden"); $("#historyToggle").classList.toggle("active", !$("#historyPanel").classList.contains("history-hidden")); });
  $("#clearHistory").addEventListener("click", async () => { history = []; await storageSet({history}); renderHistory(); showToast("History cleared"); });
  $("#f1GuardBtn").addEventListener("click", async () => { const data = await storageGet(["f1GuardEnabled"]); const enabled = data.f1GuardEnabled === false; await storageSet({f1GuardEnabled:enabled}); await updateF1Button(); showToast(enabled ? "F1 guard resumed" : "F1 guard paused"); });
  $("#converterType").addEventListener("change", configureConverter); $("#feetDimensions").addEventListener("change", configureConverter);
  [1,2,3,4].forEach(i => $("#measure"+i).addEventListener("input", calculateConverter));
  $("#clearConverter").addEventListener("click", clearConverter); $("#saveConversion").addEventListener("click", saveConversion);
  $("#copyAcre").addEventListener("click", () => { const data = calculateConverter(); if (data) copyText(`${data.display} acres`); else showToast("Enter valid measurements first"); });
  document.addEventListener("keydown", event => {
    if (event.key === "F1") { event.preventDefault(); event.stopPropagation(); showToast("F1 help shortcut blocked while this popup is open"); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || mode === "converter") return;
    if (/^[0-9.]$/.test(event.key)) append(event.key);
    else if (["+","-","*","/","(",")","^","%"].includes(event.key)) append(({"*":"×","/":"÷","-":"−"})[event.key] || event.key);
    else if (event.key === "Enter" || event.key === "=") { event.preventDefault(); doEquals(); }
    else if (event.key === "Backspace") { expression = justEvaluated ? "" : expression.slice(0,-1); justEvaluated = false; updateDisplay(); }
    else if (event.key === "Escape") { expression = ""; justEvaluated = false; updateDisplay(false); }
  }, true);
  chrome.storage?.onChanged?.addListener((changes, area) => { if (area === "local" && changes.f1GuardEnabled) updateF1Button(); });
  (async () => {
    const data = await storageGet(["history","lastAnswer","angle","mode","theme","f1GuardEnabled"]);
    history = Array.isArray(data.history) ? data.history : []; lastAnswer = Number(data.lastAnswer) || 0; angle = data.angle || "DEG";
    $("#angleLabel").textContent = angle; if (data.theme === "light") document.body.classList.add("light");
    $("#converterType").value = "feet"; configureConverter(); await setMode(data.mode || "standard"); renderHistory(); updateDisplay(false); await updateF1Button();
  })();
})();
