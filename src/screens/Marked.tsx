/** Text in which names and code are wrapped in backticks, with what is wrapped set as code. */
export function Marked({ text }: { text: string }) {
  return <>{text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;
}
