import type { SyntaxKind, SyntaxToken } from '../core/highlight';

const TOKEN_CLASS: Record<SyntaxKind, string> = {
  keyword: 'ss-tok-kw',
  type: 'ss-tok-ty',
  string: 'ss-tok-str',
  number: 'ss-tok-num',
  comment: 'ss-tok-com',
};

/** Highlighted text: each run in the `syn-*` colour of its kind. */
export function SqlTokens({ tokens }: { tokens: readonly SyntaxToken[] }) {
  return (
    <>
      {tokens.map((token, i) =>
        token.kind ? (
          <span key={i} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        ) : (
          token.text
        ),
      )}
    </>
  );
}
