import { useEffect, useRef, type ReactNode } from 'react';
import { Dialog, Heading, Modal as AriaModal, ModalOverlay } from 'react-aria-components';
import { Button } from '@mucsi96/react-ui';
import styles from './Modal.module.css';

// Compose the same React Aria primitives as react-ui's Dialog so its close
// control can be Hungarian and disabled while a mutation is in flight.
export function Modal({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  return <ModalOverlay isOpen isDismissable={!busy} isKeyboardDismissDisabled={busy} onOpenChange={open => { if (!open && !busy) onClose(); }} className={styles.overlay}>
    <AriaModal className={styles.modal}>
      <Dialog className={styles.dialog}>
        <ModalHeading title={title} />
        <Button variant="icon" aria-label="Bezárás" onPress={onClose} isDisabled={busy} className={styles.close}>×</Button>
        {children}
      </Dialog>
    </AriaModal>
  </ModalOverlay>;
}

function ModalHeading({ title }: { title: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <Heading slot="title" level={2} ref={ref} tabIndex={-1} className={styles.title}>{title}</Heading>;
}
