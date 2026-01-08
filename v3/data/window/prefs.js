document.addEventListener('change', e => {
  const id = e.target.id;

  console.log(id);

  if (id.endsWith('-check')) {
    chrome.storage.local.set({
      [id]: e.target.checked
    });
  }
});

chrome.storage.local.get({
  'color-check': true,
  'font-check': true,
  'spacing-check': false,
  'decoration-check': true,
  'element-check': false,
  'remote-check': false
}, prefs => {
  for (const [key, value] of Object.entries(prefs)) {
    document.getElementById(key).checked = value;
  }
});
