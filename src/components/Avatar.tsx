export interface AvatarProps {
  initials: string;
  name?: string;
  size?: number;
}

export function Avatar({ initials, name, size }: AvatarProps) {
  return (
    <span className="ss-avatar" title={name} style={size ? { width: size, height: size } : undefined}>
      {initials}
    </span>
  );
}
