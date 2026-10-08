import { useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { cx } from '../components/cx';
import { Modal } from '../components/Modal';
import { plural } from '../core/plural';
import { inferredRelations, qualifiedName, type Relation } from '../core/relations';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';

/** What has become of a relationship the dialog listed: still inferred, made a foreign key, or removed. */
type Decision = 'pending' | 'accepted' | 'removed';

/**
 * The inferred foreign keys of the open schema, each to be accepted (it becomes a declared foreign
 * key, which is exported) or removed. A decision takes effect at once and is one undo step; the
 * row stays in the list and says what was decided.
 */
export function ReviewInferredDialog() {
  const tables = useSchemaStore((s) => s.tables);
  const acceptInferred = useSchemaStore((s) => s.acceptInferred);
  const removeInferred = useSchemaStore((s) => s.removeInferred);
  const closeDialog = useUiStore((s) => s.closeDialog);
  // The relationships as they were when the dialog opened: a decided one keeps its row.
  const [listed] = useState<Relation[]>(() => inferredRelations(tables));

  const decisionOn = (relation: Relation): Decision => {
    const column = tables.find((t) => t.name === relation.from.table)?.columns.find((c) => c.name === relation.from.column);
    if (!column?.fk) return 'removed';
    return column.fk.inferred ? 'pending' : 'accepted';
  };
  const rows = listed.map((relation) => ({ relation, decision: decisionOn(relation) }));
  const pending = rows.filter((r) => r.decision === 'pending').length;

  return (
    <Modal
      title="Review inferred relationships"
      subtitle={
        pending
          ? `${pending} of ${plural(rows.length, 'relationship')} to review. Accepted ones become foreign keys and are exported.`
          : `All ${plural(rows.length, 'relationship')} reviewed. Nothing is lost until you save.`
      }
      icon="link"
      width={560}
      onClose={closeDialog}
      bodyStyle={{ padding: 0 }}
      footerStart={
        <Button variant="danger-ghost" icon="x" disabled={!pending} onClick={() => removeInferred()}>
          Remove all
        </Button>
      }
      footer={
        <>
          <Button icon="check" disabled={!pending} onClick={() => acceptInferred()}>
            Accept all
          </Button>
          <Button variant="primary" onClick={closeDialog} kbd="Esc" data-autofocus>
            Done
          </Button>
        </>
      }
    >
      <div className="ss-review" role="list">
        {rows.map(({ relation, decision }) => (
          <div key={qualifiedName(relation.from)} className={cx('ss-review-row', decision !== 'pending' && 'is-decided')} role="listitem">
            <span className="ss-review-name">
              {qualifiedName(relation.from)}
              <span className="ss-faint">{' → '}</span>
              {qualifiedName(relation.to)}
            </span>
            {decision === 'pending' && (
              <>
                <Button size="sm" icon="check" onClick={() => acceptInferred(relation.from)}>
                  Accept
                </Button>
                <Button size="sm" variant="ghost" icon="x" onClick={() => removeInferred(relation.from)}>
                  Remove
                </Button>
              </>
            )}
            {decision === 'accepted' && <Badge tone="added">foreign key</Badge>}
            {decision === 'removed' && <Badge tone="removed">removed</Badge>}
          </div>
        ))}
      </div>
    </Modal>
  );
}
