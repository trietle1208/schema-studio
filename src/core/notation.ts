import { t } from './i18n';

// How the ends of a relationship line are drawn. Crow's foot says how many rows may be on either
// side and whether a row may have none; the simple notation only tells the referenced table (one
// bar) from the referencing one (a foot).

export type Notation = 'crowsfoot' | 'simple';

export const DEFAULT_NOTATION: Notation = 'crowsfoot';

/** The notations in the order the settings offer them. */
export const NOTATIONS: readonly Notation[] = ['crowsfoot', 'simple'];

/** The notations to pick from, each called what the language of the app calls it. */
export function notationOptions(): { value: Notation; label: string }[] {
  return [
    { value: 'crowsfoot', label: t('notation.crowsfoot') },
    { value: 'simple', label: t('notation.simple') },
  ];
}

/** Where the chosen notation is kept in the browser. */
export const NOTATION_STORAGE_KEY = 'schema-studio.notation';

/** The notation a stored or picked value stands for. Anything that is none, such as nothing stored yet, is the default. */
export function parseNotation(value: string | null | undefined): Notation {
  return NOTATIONS.find((notation) => notation === value) ?? DEFAULT_NOTATION;
}
