/**
 * One session row shared by the "Other sessions" directory modal (V2-T55 item 3) and the
 * id-search result (item 4) — same fields (`state/projects-panel.ts#ProjectPanelOtherSessionRow`),
 * same markup, built once here so the two features never drift into two different renderings of
 * the identical row shape (AGENTS.md: "nada de duplicação"). D-041: no decision of its own — every
 * string comes from `text/messages.ts`, every value from the row `state/` already computed.
 */
import { MESSAGES } from '../text/messages.js';
import { formatSessionLastActivityText } from '../state/projects-panel.js';
import type { ProjectPanelOtherSessionRow } from '../state/projects-panel.js';

/** The short id, shown as `[id]` and copyable on click (V2-T55 item 3: "id curto e copiável") —
 * copies the SAME short id on screen, not the full `sessionId`: it's already one of that session's
 * own real prefixes (`session-id-display.ts`'s own docstring), so it works anywhere a full id
 * would. Clipboard access can be denied (a sandboxed window, no OS permission); a failed copy is
 * silent rather than an error dialog, since the id is still visible on screen either way. */
function renderCopyableId(displaySessionId: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'session-id-copy';
  button.textContent = `[${displaySessionId}]`;
  button.title = MESSAGES.otherSessionsSessionCopyIdTitle;
  button.addEventListener('click', () => {
    // `navigator.clipboard` can be `undefined` in a stricter Electron security context — the
    // optional chain short-circuits the whole expression in that case, same as a denied
    // permission below: neither is an error the person needs to see.
    void navigator.clipboard
      ?.writeText(displaySessionId)
      .then(() => {
        button.title = MESSAGES.otherSessionsSessionCopyIdCopied;
      })
      .catch(() => {
        // See this function's own docstring — a denied clipboard permission is not an error the
        // person needs to see, the id text is already right there.
      });
  });
  return button;
}

/** @example renderSessionActionRow(row) // <li> with name, [id], state, last activity, Adopt… */
export function renderSessionActionRow(row: ProjectPanelOtherSessionRow): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'session-action-row';
  item.title = row.cwd;

  const name = document.createElement('span');
  name.textContent = `${row.name} `;
  item.appendChild(name);
  item.appendChild(renderCopyableId(row.displaySessionId));

  const state = document.createElement('span');
  state.textContent = ` — ${row.stateLabel} — `;
  item.appendChild(state);

  const lastActivity = document.createElement('span');
  lastActivity.className = 'session-last-activity';
  lastActivity.textContent = MESSAGES.otherSessionsSessionLastActivityLabel(
    formatSessionLastActivityText(row.lastActivity),
  );
  item.appendChild(lastActivity);

  const adoptButton = document.createElement('button');
  adoptButton.type = 'button';
  adoptButton.className = 'adopt-button';
  adoptButton.textContent = MESSAGES.adoptButton;
  adoptButton.dataset.sessionId = row.sessionId;
  adoptButton.dataset.sessionName = row.name;
  if (row.adopt.kind === 'unavailable') {
    adoptButton.disabled = true;
    adoptButton.title = row.adopt.reason;
  }
  item.appendChild(adoptButton);

  return item;
}
