import { en } from './en';
import { vi } from './vi';

// The words of the app. English is what the design system writes and what every other language
// is checked against: `en.ts` names each message and its placeholders, and a dictionary of
// another language has a text for every one of them. What is written into a file (SQL, JSON, a
// migration and the comments in them) is not a message: it stays as the generators write it.

export type Locale = 'en' | 'vi';

export const DEFAULT_LOCALE: Locale = 'en';

/** The languages in the order the settings offer them, each called what it calls itself. */
export const LOCALES: readonly { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
];

/** Where the chosen language is kept in the browser. */
export const LOCALE_STORAGE_KEY = 'schema-studio.locale';

/** The language a stored or picked value stands for. Anything that is no language, such as nothing stored yet, is the default. */
export function parseLocale(value: string | null | undefined): Locale {
  return LOCALES.find((l) => l.value === value)?.value ?? DEFAULT_LOCALE;
}

/**
 * A message that reads differently by a number, which it takes as `count`: `1 table`, `3 tables`.
 * A language has the forms its plural rules name, and `other` for every number they do not.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export type MessageKey = keyof typeof en;

type Names<Text> = Text extends `${string}{${infer Name}}${infer Rest}` ? Name | Names<Rest> : never;

/** The placeholders of a message: the names in braces of its English text. A message with plural forms always takes `count`. */
export type ParamName<K extends MessageKey> = (typeof en)[K] extends string
  ? Names<(typeof en)[K]>
  : Names<(typeof en)[K][keyof (typeof en)[K]]> | 'count';

/** What a message is called with after its key: a value for each placeholder, or nothing when it has none. */
export type MessageArgs<K extends MessageKey, Value = string | number> = [ParamName<K>] extends [never]
  ? []
  : [params: Record<ParamName<K>, Value>];

/** Every message of the app in one language. */
export type Dictionary = { readonly [K in MessageKey]: (typeof en)[K] extends string ? string : PluralForms };

const DICTIONARIES: Record<Locale, Dictionary> = { en, vi };

const PLURAL_RULES: Record<Locale, Intl.PluralRules> = { en: new Intl.PluralRules('en'), vi: new Intl.PluralRules('vi') };

const PLACEHOLDER = /\{(\w+)\}/g;

let current: Locale = DEFAULT_LOCALE;

/** Whether a text names a message, as one put together from a value does only when the value is known: `type.family.${family}`. */
export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(en, key);
}

/** The language `t` answers in. */
export function getLocale(): Locale {
  return current;
}

/** Makes `t` answer in `locale` from here on. What was said before stays as it was said. */
export function setLocale(locale: Locale) {
  current = locale;
}

/** The text of a message in `locale` with its placeholders still in it. `count` picks the form of a message that has several. */
export function messageText(locale: Locale, key: MessageKey, count?: unknown): string {
  const message: string | PluralForms = DICTIONARIES[locale][key];
  if (typeof message === 'string') return message;
  return (typeof count === 'number' ? message[PLURAL_RULES[locale].select(count)] : undefined) ?? message.other;
}

/** A message in `locale`, whatever language the app is in: for what must read the same for everyone, such as a comment in a file. */
export function translate<K extends MessageKey>(locale: Locale, key: K, ...[params]: MessageArgs<K>): string {
  const values: Record<string, string | number> | undefined = params;
  return messageText(locale, key, values?.count).replace(PLACEHOLDER, (placeholder, name: string) =>
    values && Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}

/** A message in the language of the app: `t('validate.tableExists', { name })`. */
export function t<K extends MessageKey>(key: K, ...args: MessageArgs<K>): string {
  return translate(current, key, ...args);
}

/** `a, b or c`: the alternatives of a message, in the language of the app. */
export function anyOf(items: readonly string[]): string {
  if (items.length < 2) return items[0] ?? '';
  return t('text.or', { items: items.slice(0, -1).join(', '), last: items[items.length - 1] });
}
