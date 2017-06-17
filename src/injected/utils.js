export { sendMessage, request } from 'src/common';

export function postData(destId, data) {
  // Firefox issue: data must be stringified to avoid cross-origin problem
  const e = new CustomEvent(destId, { detail: JSON.stringify(data) });
  document.dispatchEvent(e);
}

export function inject(code) {
  const script = document.createElement('script');
  const doc = document.body || document.documentElement;
  script.textContent = code;
  doc.appendChild(script);
  try {
    doc.removeChild(script);
  } catch (e) {
    // ignore if body is changed and script is detached
  }
}

export function getUniqId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function bindEvents(srcId, destId, handle) {
  document.addEventListener(srcId, e => {
    const data = JSON.parse(e.detail);
    handle(data);
  }, false);
  return data => { postData(destId, data); };
}
