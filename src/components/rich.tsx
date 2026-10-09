import { Fragment, type ReactNode } from 'react';
import { getLocale, messageText, type MessageArgs, type MessageKey } from '../core/i18n';

const PLACEHOLDER = /\{(\w+)\}/;

/**
 * A message whose placeholders stand for elements instead of text, in the language of the app:
 * `rich('dropzone.title', { browse: <u>…</u> })`. The words around an element go where the
 * language puts them.
 */
export function rich<K extends MessageKey>(key: K, ...[params]: MessageArgs<K, ReactNode>): ReactNode {
  const values: Record<string, ReactNode> | undefined = params;
  // Split on a group, the text and the names of the placeholders alternate.
  const parts = messageText(getLocale(), key, values?.count).split(PLACEHOLDER);
  return parts.map((part, i) => (i % 2 ? <Fragment key={i}>{values?.[part]}</Fragment> : part));
}
