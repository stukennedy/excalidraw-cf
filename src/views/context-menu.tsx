export function ContextMenu() {
  return (
    <div id="context-menu" class="context-menu" style="display:none">
      <button class="ctx-item" data-action="copy">
        Copy <span class="ctx-shortcut">Ctrl+C</span>
      </button>
      <button class="ctx-item" data-action="paste">
        Paste <span class="ctx-shortcut">Ctrl+V</span>
      </button>
      <button class="ctx-item" data-action="cut">
        Cut <span class="ctx-shortcut">Ctrl+X</span>
      </button>
      <div class="ctx-divider" />
      <button class="ctx-item" data-action="delete">
        Delete <span class="ctx-shortcut">Del</span>
      </button>
      <div class="ctx-divider" />
      <button class="ctx-item" data-action="bringToFront">
        Bring to front <span class="ctx-shortcut">Ctrl+Shift+]</span>
      </button>
      <button class="ctx-item" data-action="sendToBack">
        Send to back <span class="ctx-shortcut">Ctrl+Shift+[</span>
      </button>
    </div>
  );
}
