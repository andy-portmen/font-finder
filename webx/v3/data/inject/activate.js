/* global mouseover */

mouseover({
  target: [...document.querySelectorAll(':hover')].pop() || document.activeElement
});
