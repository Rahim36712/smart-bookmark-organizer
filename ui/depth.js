// Pointer depth is decorative only; controls never move away from the pointer.
// No render loop, external assets, WebGL context, or bookmark access is needed.
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
for (const scene of document.querySelectorAll('.depth-scene')) {
  let frame = 0;
  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    scene.style.removeProperty('--scene-x');
    scene.style.removeProperty('--scene-y');
  };
  scene.addEventListener('pointermove', event => {
    if (motion.matches || !finePointer.matches) return;
    const rect = scene.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      scene.style.setProperty('--scene-x', `${x * 8}deg`);
      scene.style.setProperty('--scene-y', `${-y * 6}deg`);
    });
  });
  scene.addEventListener('pointerleave', reset);
  motion.addEventListener('change', reset);
  finePointer.addEventListener('change', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
}
