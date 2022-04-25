{
  const s = window.getSelection();
  const r = s.getRangeAt(0);
  let aElement = r.commonAncestorContainer;
  if (aElement.nodeType !== Element.ELEMENT_NODE) {
    aElement = aElement.parentElement;
  }
  if (aElement) {
    const name = window.prompt(
      'Enter the new font name',
      window.getComputedStyle(aElement).getPropertyValue('font-family')
    );
    if (name) {
      aElement.style['font-family'] = name;
    }
  }
  else {
    alert('Please refresh this tab and retry');
  }
}
