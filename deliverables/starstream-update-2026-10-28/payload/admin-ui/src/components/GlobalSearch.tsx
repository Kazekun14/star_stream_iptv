import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

const pages = [
  { label: "Settings", path: "/settings", keywords: "account profile preferences" },
  { label: "Dashboard", path: "/dashboard", keywords: "overview statistics" },
  { label: "Categories", path: "/categories", keywords: "category live" },
  { label: "Packages", path: "/packages", keywords: "package subscription" },
  { label: "Channels", path: "/channels", keywords: "channel live streams" },
  { label: "Package Channels", path: "/package-channels", keywords: "package channels assignment" },
  { label: "Users", path: "/users", keywords: "user accounts registered" },
];

export default function GlobalSearch() {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const results = pages.filter(page => `${page.label} ${page.keywords}`.toLowerCase().includes(query.trim().toLowerCase()));

  React.useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [pathname]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function select(path: string) {
    setOpen(false);
    setQuery("");
    input.current?.blur();
    navigate(path);
  }

  return (
    <div className="global-search" role="search" aria-label="Page navigation" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <div className="global-search-field">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-label="Search pages"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
          placeholder="Search pages…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onFocus={() => { setOpen(true); setActive(0); }}
          onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
          onKeyDown={event => {
            if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive(value => results.length ? (value + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : 0);
            }
            if (event.key === "Enter" && open && results[active]) {
              event.preventDefault();
              select(results[active].path);
            }
          }}
        />
        <kbd className="global-search-shortcut">{navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl"} K</kbd>
      </div>
      {open && <div className="global-search-popover">
        <div className="global-search-caption">Go to page</div>
        <div id={id} role="listbox" aria-label="Pages">
          {results.map((page, index) => <div
            key={page.path}
            id={`${id}-${index}`}
            role="option"
            aria-selected={index === active}
            className="global-search-result"
            onMouseDown={event => event.preventDefault()}
            onMouseEnter={() => setActive(index)}
            onClick={() => select(page.path)}
          ><span>{page.label}</span><span aria-hidden="true">↗</span></div>)}
        </div>
        {results.length === 0 && <p className="global-search-empty" role="status">No matching pages.</p>}
      </div>}
    </div>
  );
}
