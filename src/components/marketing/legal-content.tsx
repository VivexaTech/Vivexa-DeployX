/** Renders the simple legal text format (paragraphs, "## " headings, "- " lists). */
export function LegalContent({ source }: { source: string }) {
  const blocks = source.trim().split(/\n\s*\n/);
  return (
    <div className="prose-legal">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) return null;
        if (lines[0].startsWith("## ")) {
          const [heading, ...rest] = lines;
          return (
            <div key={i}>
              <h2>{heading.slice(3)}</h2>
              {renderLines(rest, i)}
            </div>
          );
        }
        return <div key={i}>{renderLines(lines, i)}</div>;
      })}
    </div>
  );
}

function renderLines(lines: string[], key: number) {
  if (lines.length === 0) return null;
  if (lines.every((l) => l.startsWith("- "))) {
    return (
      <ul key={key}>
        {lines.map((l, j) => (
          <li key={j}>{l.slice(2)}</li>
        ))}
      </ul>
    );
  }
  const items = lines.filter((l) => l.startsWith("- "));
  const text = lines.filter((l) => !l.startsWith("- ")).join(" ");
  return (
    <>
      {text && <p>{text}</p>}
      {items.length > 0 && (
        <ul>
          {items.map((l, j) => (
            <li key={j}>{l.slice(2)}</li>
          ))}
        </ul>
      )}
    </>
  );
}
