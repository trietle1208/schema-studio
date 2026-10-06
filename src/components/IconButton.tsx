import { Button, type ButtonProps } from './Button';
import type { IconName } from './icons';

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: IconName;
  label: string;
}

export function IconButton({ label, icon, title, ...rest }: IconButtonProps) {
  return <Button variant="ghost" {...rest} icon={icon} title={title || label} aria-label={label} />;
}
