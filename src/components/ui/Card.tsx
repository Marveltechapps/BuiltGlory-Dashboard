import type { CSSProperties, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  padding?: 'none' | 'compact' | 'default';
  /** 16px radius used by dashboard widgets. */
  large?: boolean;
  flat?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}

export function Card({ children, padding = 'none', large, flat, interactive, onClick, style, className }: CardProps) {
  const cls = [
    styles.card,
    padding === 'default' ? styles.padded : padding === 'compact' ? styles.compact : '',
    large ? styles.rounded2xl : '',
    flat ? styles.flat : '',
    interactive ? styles.interactive : '',
    className ?? '',
  ].join(' ');
  return (
    <article className={cls} style={style} onClick={onClick}>
      {children}
    </article>
  );
}

export function CardHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  if (right) {
    return (
      <div className={styles.headRow}>
        <div>
          <h3 className={styles.title}>{title}</h3>
          {subtitle && <p className={styles.subtitle} style={{ marginTop: 2 }}>{subtitle}</p>}
        </div>
        {right}
      </div>
    );
  }
  return (
    <div className={styles.head}>
      <h3 className={styles.title}>{title}</h3>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}

export const CardBody = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className={styles.body} style={style}>{children}</div>
);

export const CardFooter = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className={styles.footer} style={style}>{children}</div>
);
