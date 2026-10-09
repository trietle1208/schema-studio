import type { ReactNode } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Crumb } from '../components/Toolbar';
import { t } from '../core/i18n';
import { SCHEMAS_ROUTE } from '../core/routes';
import { useSchemaStore } from '../store/schema';
import { go } from './navigation';

export interface SchemaCrumbsProps {
  /** The name of the screen, the last step of the breadcrumb. */
  title: string;
  /** Goes after the breadcrumb, in place of the engine badge. */
  children?: ReactNode;
  /** Goes at the end, in place of the button back to the diagram; the schema's name in the breadcrumb still leads there. */
  actions?: ReactNode;
}

/** The toolbar of a screen under the open schema: Schemas › name › title, and the way back to the diagram. */
export function SchemaCrumbs({ title, children, actions }: SchemaCrumbsProps) {
  const name = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const back = () => go({ screen: 'workspace', schema: name });

  return (
    <header className="ss-toolbar">
      <div className="ss-tb-crumb">
        <Crumb onClick={() => go(SCHEMAS_ROUTE)}>{t('common.schemas')}</Crumb>
        <Icon name="chevron-right" size={12} />
        <Crumb className="ss-tb-name" onClick={back}>
          {name}
        </Crumb>
        <Icon name="chevron-right" size={12} />
        <span style={{ color: 'var(--ink-1)' }}>{title}</span>
      </div>
      {children ?? <Badge dot>{engine}</Badge>}
      <span className="ss-spacer" />
      {actions ?? (
        <Button icon="arrow-right" variant="ghost" onClick={back}>
          {t('crumbs.back')}
        </Button>
      )}
    </header>
  );
}
