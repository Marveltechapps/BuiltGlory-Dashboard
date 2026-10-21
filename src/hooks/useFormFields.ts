import { useCallback, useState } from 'react';
import type { FormInput } from '../types/detail';

type Value = string | boolean;
type InputOptions = Omit<Partial<FormInput>, 'key' | 'label' | 'value' | 'onChange' | 'error'> & { default?: Value };

/** Local form state for declarative detail sections: values, errors, and FormInput builders. */
export function useFormFields() {
  const [values, setValues] = useState<Record<string, Value>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const val = useCallback(<T extends Value = string>(k: string, d?: T): T => (values[k] ?? d ?? '') as T, [values]);
  const str = (k: string, d = '') => String(values[k] ?? d);

  const set = useCallback((k: string, v: Value) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((s) => (s[k] ? { ...s, [k]: '' } : s));
  }, []);

  const inp = (k: string, label: string, o: InputOptions = {}): FormInput => {
    const { default: d, ...rest } = o;
    return { ...rest, key: k, label, value: values[k] ?? d ?? (o.type === 'checkbox' ? false : ''), error: errors[k] || '', onChange: (v) => set(k, v) };
  };

  /** Marks empty keys with their message; returns true when all are filled. */
  const need = (map: Record<string, string>, defaults: Record<string, Value> = {}) => {
    const e: Record<string, string> = {};
    Object.keys(map).forEach((k) => {
      const v = values[k] ?? defaults[k];
      if (v == null || String(v).trim() === '' || v === false) e[k] = map[k]!;
    });
    if (Object.keys(e).length) {
      setErrors((s) => ({ ...s, ...e }));
      return false;
    }
    return true;
  };

  const fail = (k: string, msg: string) => {
    setErrors((s) => ({ ...s, [k]: msg }));
    return false;
  };

  const clear = (prefix: string) => {
    setValues((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith(prefix))));
    setErrors((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith(prefix))));
  };

  const reset = () => {
    setValues({});
    setErrors({});
  };

  return { values, errors, val, str, set, inp, need, fail, clear, reset, setValues };
}

export type FormFields = ReturnType<typeof useFormFields>;
