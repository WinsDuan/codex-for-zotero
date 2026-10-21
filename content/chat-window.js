window.addEventListener('load', async () => {
  const { controller, item, prompt, task } = window.arguments[0];
  const body = document.getElementById('codex-chat-container');
  const view = controller.createView(body, document, item);
  if (prompt) view.input.value = prompt;
  if (task) view.task.value = task;
  window.addEventListener('unload', () => controller.removeView(body), { once: true });
}, { once: true });
