/**
 * JsonTreeView — tiny dependency-free collapsible JSON viewer.
 *
 * Renders any JSON-compatible value as a monospace tree where every
 * object / array can be expanded or collapsed independently. Collapsed
 * containers show a short summary (`{ 3 keys }` / `[ 12 items ]`) so the
 * shape stays readable at a glance.
 *
 * Expansion state lives in each node. To expand / collapse everything
 * at once, change `defaultExpandDepth` and bump `resetKey` — the tree
 * remounts with the new depth.
 */
import { useState, type FC, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface JsonTreeViewProps {
  /** Any JSON-compatible value (object, array, primitive). */
  data: unknown;
  /** Containers shallower than this depth start expanded (root = 0). Default 2. */
  defaultExpandDepth?: number;
  /** Change to force-remount the tree (e.g. after "Expand all"). */
  resetKey?: string | number;
  /** Optional label for the root node. */
  rootLabel?: string;
  className?: string;
}

type Container = Record<string, unknown> | unknown[];

function isContainer(value: unknown): value is Container {
  return value !== null && typeof value === 'object';
}

function renderPrimitive(value: unknown): ReactNode {
  if (value === null) return <span className="text-[var(--hrk-text-tertiary)] italic">null</span>;
  if (value === undefined) return <span className="text-[var(--hrk-text-tertiary)] italic">undefined</span>;
  switch (typeof value) {
    case 'string':
      return <span className="break-all whitespace-pre-wrap text-emerald-400">{JSON.stringify(value)}</span>;
    case 'number':
    case 'bigint':
      return <span className="text-sky-400">{String(value)}</span>;
    case 'boolean':
      return <span className="text-amber-400">{String(value)}</span>;
    default:
      return <span className="text-[var(--hrk-text-secondary)]">{String(value)}</span>;
  }
}

function KeyLabel({ name, isIndex }: { name?: string; isIndex?: boolean }) {
  if (name === undefined) return null;
  return (
    <>
      <span className={isIndex ? 'text-[var(--hrk-text-tertiary)]' : 'text-violet-300'}>
        {isIndex ? name : JSON.stringify(name)}
      </span>
      <span className="text-[var(--hrk-text-tertiary)]">: </span>
    </>
  );
}

interface NodeProps {
  name?: string;
  isIndex?: boolean;
  value: unknown;
  depth: number;
  defaultExpandDepth: number;
  isLast: boolean;
}

const JsonNode: FC<NodeProps> = ({ name, isIndex, value, depth, defaultExpandDepth, isLast }) => {
  const [open, setOpen] = useState(depth < defaultExpandDepth);
  const comma = isLast ? null : <span className="text-[var(--hrk-text-tertiary)]">,</span>;

  if (!isContainer(value)) {
    return (
      <div className="pl-5">
        <KeyLabel name={name} isIndex={isIndex} />
        {renderPrimitive(value)}
        {comma}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries: Array<[string, unknown]> = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const [openBr, closeBr] = isArray ? ['[', ']'] : ['{', '}'];
  const count = entries.length;
  const summary = isArray
    ? `${count} item${count === 1 ? '' : 's'}`
    : `${count} key${count === 1 ? '' : 's'}`;

  if (count === 0) {
    return (
      <div className="pl-5">
        <KeyLabel name={name} isIndex={isIndex} />
        <span className="text-[var(--hrk-text-secondary)]">{openBr}{closeBr}</span>
        {comma}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start rounded text-left hover:bg-[var(--hrk-bg-hover)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--hrk-brand)]"
      >
        <span className="mt-[2px] inline-flex h-4 w-5 shrink-0 items-center justify-center text-[var(--hrk-text-tertiary)]">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0">
          <KeyLabel name={name} isIndex={isIndex} />
          <span className="text-[var(--hrk-text-secondary)]">{openBr}</span>
          {!open && (
            <>
              <span className="mx-1 rounded bg-[var(--hrk-bg-hover)] px-1 text-[11px] text-[var(--hrk-text-tertiary)]">
                {summary}
              </span>
              <span className="text-[var(--hrk-text-secondary)]">{closeBr}</span>
              {comma}
            </>
          )}
        </span>
      </button>
      {open && (
        <>
          <div className="ml-[9px] border-l border-[var(--hrk-border-subtle)] pl-2">
            {entries.map(([k, v], i) => (
              <JsonNode
                key={k}
                name={k}
                isIndex={isArray}
                value={v}
                depth={depth + 1}
                defaultExpandDepth={defaultExpandDepth}
                isLast={i === count - 1}
              />
            ))}
          </div>
          <div className="pl-5">
            <span className="text-[var(--hrk-text-secondary)]">{closeBr}</span>
            {comma}
          </div>
        </>
      )}
    </div>
  );
};

export function JsonTreeView({
  data,
  defaultExpandDepth = 2,
  resetKey,
  rootLabel,
  className = '',
}: JsonTreeViewProps) {
  return (
    <div
      key={resetKey}
      className={`font-mono text-xs leading-5 text-[var(--hrk-text-primary)] ${className}`}
    >
      <JsonNode
        name={rootLabel}
        value={data}
        depth={0}
        defaultExpandDepth={defaultExpandDepth}
        isLast
      />
    </div>
  );
}

export default JsonTreeView;
