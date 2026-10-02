/**
 * The daemon-ownership transition dialog (V2-T71, `docs/INTERFACE.md` § 9 — "Transição de posse
 * do daemon: o que cada escolha faz e que a pergunta é única; `Leave it as it is` e `Let seeya
 * take over`. Passa a ter o estilo dos demais diálogos"). Replaces `renderer/legacy/
 * daemon-ownership-transition-view.ts`/the static `<Dialog
 * id="daemon-ownership-transition-dialog">` anchor (both apagados by this task) — same
 * `getDaemonOwnershipTransitionOffer`/`answerDaemonOwnershipTransition` IPC calls, fetched once on
 * mount instead of from `renderer.tsx#main`'s own explicit call (this component owns asking now).
 *
 * **The "Working…" state becomes `loading` on the button that was actually clicked** (the task's
 * own correction of the legacy dialog's shared status line, which lit up for either button) —
 * `pendingAnswer` names which one, so the OTHER button is simply disabled while it resolves,
 * never also shown as working.
 *
 * @example
 * <DaemonOwnershipTransitionDialog/> // mounted once, in App.tsx
 */
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import styles from './DaemonOwnershipTransitionDialog.module.css';
import { cx } from '../../../components/css-class.js';
import { Dialog } from '../../../components/Dialog/index.js';
import { Text } from '../../../components/Text/index.js';
import { Button } from '../../../components/Button/index.js';
import { Stack } from '../../../components/Stack/index.js';
import { MESSAGES } from '../../../../text/messages.js';
import { getSeeyaApi } from '../../../ipc/client.js';

type Answer = 'accepted' | 'declined';

export function DaemonOwnershipTransitionDialog(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [launchPath, setLaunchPath] = useState('');
  const [pendingAnswer, setPendingAnswer] = useState<Answer | null>(null);

  // Fetched once, on mount — the SAME "ask once per machine, never re-checked later in this
  // session" shape `renderer/legacy/daemon-ownership-transition-view.ts#
  // offerDaemonOwnershipTransitionIfNeeded` already had; this component just owns the call itself
  // now instead of `renderer.tsx#main` calling it explicitly after every other wiring.
  useEffect(() => {
    void getSeeyaApi()
      .getDaemonOwnershipTransitionOffer()
      .then((offer) => {
        if (offer.shouldOffer) {
          setLaunchPath(offer.launchPath);
          setOpen(true);
        }
      });
  }, []);

  function answer(value: Answer): void {
    setPendingAnswer(value);
    void getSeeyaApi()
      .answerDaemonOwnershipTransition({ answer: value })
      .then(() => setOpen(false));
  }

  // The machine's own question must not be left unanswered forever (it would just reopen next
  // launch, since nothing would ever get persisted) — Escape/any native dismissal declines,
  // mirroring the legacy dialog's own "cancel" handling.
  function handleClose(): void {
    if (pendingAnswer === null) {
      answer('declined');
    }
  }

  return (
    <Dialog
      id="daemon-ownership-transition-dialog"
      title={MESSAGES.daemonOwnershipTransitionTitle}
      open={open}
      onClose={handleClose}
      className={cx(styles, 'dialog')}
      footer={
        <>
          <Button
            id="daemon-ownership-transition-decline"
            variant="secondary"
            disabled={pendingAnswer !== null}
            loading={pendingAnswer === 'declined'}
            onClick={() => answer('declined')}
          >
            {MESSAGES.daemonOwnershipTransitionDecline}
          </Button>
          <Button
            id="daemon-ownership-transition-accept"
            disabled={pendingAnswer !== null}
            loading={pendingAnswer === 'accepted'}
            onClick={() => answer('accepted')}
          >
            {MESSAGES.daemonOwnershipTransitionAccept}
          </Button>
        </>
      }
    >
      <Stack gap="md">
        <Text as="p" variant="body-sm" tone="secondary">
          {MESSAGES.daemonOwnershipTransitionBody(launchPath)}
        </Text>
        <Stack gap="xs">
          <Text as="p" variant="body-sm" tone="secondary">
            <strong>{MESSAGES.daemonOwnershipTransitionDecline}:</strong>{' '}
            {MESSAGES.daemonOwnershipTransitionDeclineExplanation}
          </Text>
          <Text as="p" variant="body-sm" tone="secondary">
            <strong>{MESSAGES.daemonOwnershipTransitionAccept}:</strong>{' '}
            {MESSAGES.daemonOwnershipTransitionAcceptExplanation}
          </Text>
        </Stack>
      </Stack>
    </Dialog>
  );
}
