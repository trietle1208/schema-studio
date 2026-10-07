import type { ReactNode } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Crumb } from '../components/Toolbar';
import { SCHEMAS_ROUTE } from '../core/routes';
import { useSchemaStore } from '../store/schema';
import { go } from './navigation';

export interface SchemaCrumbsProps {
  /** The name of the screen, the last step of the breadcrumb. */
  title: string;
  /** Goes after the engine badge. */
  children?: ReactNode;
}

/** The toolbar of a screen under the open schema: Schemas › name › title, and the way back to the diagram. */
export function SchemaCrumbs({ title, children }: SchemaCrumbsProps) {
  const name = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const back = () => go({ screen: 'workspace', schema: name });

  return (
    <header className="ss-toolbar">
      <div className="ss-tb-crumb">
        <Crumb onClick={() => go(SCHEMAS_ROUTE)}>Schemas</Crumb>
        <Icon name="chevron-right" size={12} />
        <Crumb className="ss-tb-name" onClick={back}>
          {name}
        </Crumb>
        <Icon name="chevron-right" size={12} />
        <span style={{ color: 'var(--ink-1)' }}>{title}</span>
      </div>
      <Badge dot>{engine}</Badge>
      {children}
      <span className="ss-spacer" />
      <Button icon="arrow-right" variant="ghost" onClick={back}>
        Back to diagram
      </Button>
    </header>
  );
}
