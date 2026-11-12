import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import type { Panel } from "./SideNav";
import Icon from "./Icon";

interface DialogProps {
  title: string;
  panel: Panel;
  closing: boolean;
  onClose: () => void;
  onExited: () => void;
  children: ReactNode;
  navigation?: ReactNode;
}

export default function Dialog({
  title,
  panel,
  closing,
  onClose,
  onExited,
  children,
  navigation,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (
        (previousFocus instanceof HTMLElement ||
          previousFocus instanceof SVGElement) &&
        previousFocus.isConnected
      )
        previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (!closing) return;
    let active = true;
    const animations = panelRef.current?.getAnimations() ?? [];
    // Canceled transitions (including reduced-motion changes) also finish closing.
    void Promise.all(
      animations.map((animation) => animation.finished.catch(() => undefined)),
    ).then(() => {
      if (active) onExited();
    });
    return () => {
      active = false;
    };
  }, [closing, onExited]);

  return (
    <dialog
      ref={dialogRef}
      className="legacy-dialog"
      data-state={closing ? "closing" : "open"}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <section ref={panelRef} className={"legacy-panel legacy-panel--" + panel}>
        <header className="panel-header">
          <div className="panel-title">
            <span className="panel-title-icon">
              <Icon name={panel} />
            </span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            className="close-panel"
            aria-label={"关闭" + title}
            title="关闭（Esc）"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="panel-content">
          <div key={panel} className="panel-view">
            {children}
          </div>
        </div>
      </section>
      {navigation}
    </dialog>
  );
}
