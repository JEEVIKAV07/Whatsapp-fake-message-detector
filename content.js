// content.js (robust forwarded-message detector + UI label)
// Backend URL
const BACKEND_URL = "http://127.0.0.1:5000/predict";

// small constants
const CHECKED_ATTR = "data-fake-checked";
const LABEL_CLASS = "fake-detector-label";

// helper: determine whether prediction means fake
function isPredictionFake(pred) {
  if (pred === null || pred === undefined) return false;
  if (typeof pred === "string") {
    return /fake|forwarded|fraud|hoax/i.test(pred);
  }
  if (typeof pred === "number") {
    // some models use 1/0 mapping — adjust if your model uses different mapping
    return pred === 1;
  }
  return false;
}

// helper: add a small label to message element
function attachLabel(msgElem, pred) {
  try {
    if (!msgElem || msgElem.querySelector(`.${LABEL_CLASS}`)) return; // already labeled

    const label = document.createElement("div");
    label.className = LABEL_CLASS;
    label.style.fontSize = "12px";
    label.style.marginTop = "4px";
    label.style.padding = "2px 6px";
    label.style.borderRadius = "6px";
    label.style.display = "inline-block";

    const fake = isPredictionFake(pred);
    label.innerText = fake ? "⚠️ Fake" : "✅ Real";
    label.style.background = fake ? "rgba(255, 180, 180, 0.95)" : "rgba(200, 255, 200, 0.95)";
    label.style.color = "#222";

    // append label as last child of message container
    msgElem.appendChild(label);
  } catch (err) {
    console.error("attachLabel error:", err);
  }
}

// helper: extract candidate message text from message container
function extractMessageText(msgElem) {
  try {
    // Try common selectable-text spans first
    const textSpan = msgElem.querySelector("span.selectable-text, span[dir='ltr']");
    if (textSpan && textSpan.innerText && textSpan.innerText.trim().length > 0) {
      return textSpan.innerText.trim();
    }

    // fallback: whole element text minus 'Forwarded' words
    let full = msgElem.innerText || "";
    full = full.replace(/Forwarded\s*many\s*times/gi, "");
    full = full.replace(/\bForwarded\b/gi, "");
    full = full.trim();

    // return first reasonable line (avoid timestamps/senders)
    const lines = full.split("\n").map(l => l.trim()).filter(Boolean);
    for (let ln of lines) {
      // skip lines that look like time or "You:" etc.
      if (/^\d{1,2}:\d{2}$/.test(ln)) continue;
      if (/^You[:\s]/i.test(ln)) continue;
      if (ln.length > 4) return ln;
    }
    return lines[0] || full;
  } catch (err) {
    console.error("extractMessageText error:", err);
    return "";
  }
}

// send to backend and attach label based on result
async function checkMessageWithBackend(text, msgElem) {
  try {
    console.log("Sending to backend:", text);
    const resp = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    if (!resp.ok) {
      console.error("Backend returned HTTP", resp.status);
      return;
    }

    const data = await resp.json();
    console.log("Backend response:", data);
    attachLabel(msgElem, data.prediction ?? data.result ?? data); // try several field names
  } catch (err) {
    console.error("Error contacting backend:", err);
  }
}

// scan for forwarded labels inside a message container (robust)
function hasForwardedLabel(msgElem) {
  try {
    // Find any descendant node whose visible text contains "Forwarded"
    const walker = document.createTreeWalker(msgElem, NodeFilter.SHOW_ELEMENT, null, false);
    let node;
    while (node = walker.nextNode()) {
      const txt = (node.innerText || "").trim();
      if (/^Forwarded$/i.test(txt) || /Forwarded many times/i.test(txt) || /forwarded/i.test(txt) ) {
        return true;
      }
      // also check aria-label or title attributes
      const aria = node.getAttribute && (node.getAttribute("aria-label") || node.getAttribute("title") || "");
      if (/forwarded/i.test(aria)) return true;
    }
    return false;
  } catch (err) {
    console.error("hasForwardedLabel error:", err);
    return false;
  }
}

// main scanning function (safe)
function scanForwardedMessages() {
  try {
    // Find message containers — use attribute used by WhatsApp for message rows
    const messageContainers = document.querySelectorAll("[data-pre-plain-text], div.copyable-text, div[role='row']");
    messageContainers.forEach(msg => {
      try {
        if (!msg || msg.getAttribute(CHECKED_ATTR)) return;

        if (hasForwardedLabel(msg)) {
          const text = extractMessageText(msg);
          if (text && text.length > 0) {
            msg.setAttribute(CHECKED_ATTR, "true"); // mark as checked
            checkMessageWithBackend(text, msg);
          } else {
            // mark checked so we don't reprocess empty containers repeatedly
            msg.setAttribute(CHECKED_ATTR, "true");
          }
        }
      } catch (innerErr) {
        console.error("inner scan error for one message:", innerErr);
      }
    });
  } catch (err) {
    console.error("scanForwardedMessages error:", err);
  }
}

// start scanning periodically
console.log("WhatsApp forwarded-message detector started");
setInterval(scanForwardedMessages, 2500);