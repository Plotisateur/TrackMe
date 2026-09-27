import { useEffect, useRef, useState } from 'react';
import type { TextInputProps } from 'react-native';
import { Field } from './ui';

/**
 * Text field that saves itself: after a short pause, on end of editing, and on unmount.
 * Notes typed mid-workout are never lost because a button was tapped with the keyboard open.
 */
export function AutoSaveField({
  initialValue,
  onSave,
  delayMs = 600,
  ...props
}: Omit<TextInputProps, 'value' | 'onChangeText' | 'defaultValue'> & {
  label?: string;
  hint?: string;
  initialValue?: string;
  onSave(text: string): void;
  delayMs?: number;
}) {
  const [text, setText] = useState(initialValue ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const saveRef = useRef(onSave);

  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current !== null) {
      const value = pending.current;
      pending.current = null;
      saveRef.current(value);
    }
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current !== null) saveRef.current(pending.current);
    },
    [],
  );

  return (
    <Field
      {...props}
      value={text}
      onChangeText={(t) => {
        setText(t);
        pending.current = t;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, delayMs);
      }}
      onEndEditing={flush}
    />
  );
}
