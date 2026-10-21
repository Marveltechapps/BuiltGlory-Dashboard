import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'green' | 'red' | 'amber' | 'destructive' | 'solidGreen' | 'link';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: string;
  iconSize?: number;
  loading?: boolean;
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Button({ variant = 'outline', size = 'sm', icon, iconSize, loading, iconOnly, children, className, type = 'button', disabled, ...rest }: ButtonProps) {
  const cls = [styles.btn, styles[size], styles[variant], iconOnly ? styles.icon : '', className ?? ''].join(' ');
  const isz = iconSize ?? (size === 'md' || size === 'lg' ? 16 : 14);
  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <Icon name="loader-2" size={isz} spin /> : icon ? <Icon name={icon} size={isz} /> : null}
      {children}
    </button>
  );
}
