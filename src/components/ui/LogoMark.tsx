/** BuiltGlory dashboard mark. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/logo.png?v=2"
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, display: 'block' }}
    />
  );
}
