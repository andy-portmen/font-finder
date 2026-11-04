// kill any open old panel first
[...document.querySelectorAll('#font-finder-embedded-div')].forEach(d => d.remove());

{
  const dialog = document.createElement('dialog');
  dialog.id = 'font-finder-embedded-div';
  // anchored to the bottom-right corner like the old overlay; the top layer
  // keeps the panel above the page, the ::backdrop is transparent by default
  // and the modal state keeps the page underneath inert
  dialog.style = `
    position: fixed;
    inset: auto 15px 15px auto;
    width: min(600px, calc(100vw - 50px));
    height: min(700px, calc(100vh - 50px));
    margin: 0;
    border: none;
    padding: 0;
    background-color: transparent;
    color: initial;
  `;

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('data/window/index.html?mode=embed&id=' + self.id + '&opener=' + self.opener);
  iframe.style = `
    width: 100%;
    height: 100%;
    border: none;
    background-color: #fff;
    display: block;
  `;
  dialog.appendChild(iframe);

  // a click on the transparent backdrop (modal) lands on the dialog itself;
  // clicks inside the iframe never bubble this far
  dialog.addEventListener('click', e => {
    if (e.target === dialog) {
      dialog.close();
    }
  });
  // released on Esc (cancel + close) or close-me; keep the tree clean
  dialog.addEventListener('close', () => dialog.remove());

  (document.body || document.documentElement).appendChild(dialog);
  dialog.showModal();
}
