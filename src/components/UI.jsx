import { useEffect, useRef, useId, cloneElement } from "react";
import { X, Plus, ArrowUpRight } from "lucide-react";
export function Button({ children, secondary = false, ...props }) {
  return (
    <button className={secondary ? "button secondary" : "button"} {...props}>
      {children}
    </button>
  );
}
export function Empty({
  icon: Icon = Plus,
  title,
  description,
  action,
  onClick,
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <Button onClick={onClick}>
          <Plus size={16} />
          {action}
          <ArrowUpRight size={16} />
        </Button>
      )}
    </div>
  );
}
export function Modal({ title, children, onClose }) {
  const ref = useRef();
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({ label, children }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
export function PageHead({ eyebrow, title, description, children }) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}
