import { useId, useLayoutEffect, useRef, type InputHTMLAttributes } from 'react';
import styles from './Fields.module.css';

export function NumberField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return <div className={styles.field}><label htmlFor={id}>{label}</label><input id={id} type="number" {...props} /></div>;
}

export function AutoTextarea({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => { element.style.height = 'auto'; element.style.height = `${element.scrollHeight + 2}px`; };
    resize();
    const observer = new ResizeObserver(resize);
    // Observe the parent width, not the textarea's changing height.
    const parent = element.parentElement;
    if (parent) observer.observe(parent);
    return () => observer.disconnect();
  }, [value]);
  return <div className={styles.field}><label htmlFor={id}>{label}</label><textarea id={id} ref={ref} rows={3} required value={value} onChange={event => onChange(event.target.value)} disabled={disabled} /></div>;
}
