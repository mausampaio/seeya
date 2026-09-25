/**
 * The id-search field itself (V2-T55 item 4) — "an id or the start of it, straight to the session,
 * even outside the 12-hour window". Submits to `CHANNELS.findSessionById`
 * (`electron/session-search-ipc.ts`) and renders the result with `session-row-view.ts
 * #renderSessionActionRow` — the SAME row the "Other sessions" directory modal shows, so a
 * search hit and a modal row never look like two different things.
 */
import { MESSAGES } from '../text/messages.js';
import { renderSessionActionRow } from './session-row-view.js';
import type { FindSessionByIdResponse } from '../ipc/channels.js';

function renderResult(response: FindSessionByIdResponse): void {
  const message = document.getElementById('session-search-message') as HTMLElement;
  const list = document.getElementById('session-search-result') as HTMLElement;
  message.textContent = '';
  list.textContent = '';

  if (response.kind === 'notFound') {
    message.textContent = MESSAGES.sessionSearchNotFound(lastQuery);
    return;
  }
  if (response.kind === 'ambiguous') {
    message.textContent = MESSAGES.sessionSearchAmbiguous(lastQuery, response.candidates.length);
    for (const row of response.candidates) {
      list.appendChild(renderSessionActionRow(row));
    }
    return;
  }
  list.appendChild(renderSessionActionRow(response.session));
}

// Read back by `renderResult` above for the notFound/ambiguous message text (which names the
// query the person typed) — set right before the request goes out, in `submitSearch` below.
let lastQuery = '';

function submitSearch(): void {
  const input = document.getElementById('session-search-input') as HTMLInputElement;
  const idOrPrefix = input.value.trim();
  if (idOrPrefix === '') {
    return;
  }
  lastQuery = idOrPrefix;
  void window.seeya.findSessionById({ idOrPrefix }).then(renderResult);
}

/** Wired once, at startup, from `electron/project-panel-view.ts#wireProjectPanel`. */
export function wireSessionSearchView(): void {
  (document.getElementById('session-search-label') as HTMLElement).textContent =
    MESSAGES.sessionSearchLabel;
  (document.getElementById('session-search-input') as HTMLInputElement).placeholder =
    MESSAGES.sessionSearchPlaceholder;
  (document.getElementById('session-search-button') as HTMLButtonElement).textContent =
    MESSAGES.sessionSearchButton;

  document.getElementById('session-search-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitSearch();
  });
}
