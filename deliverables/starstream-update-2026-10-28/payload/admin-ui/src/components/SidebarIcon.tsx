import React from "react";

type IconName = "dashboard" | "category" | "package" | "channels" | "assign" | "users" | "settings" | "logout" | "menu" | "collapse";
const paths: Record<IconName, React.ReactNode> = {
  settings: <><path d="m9 3-.5 2.5-2 1.2L4 6l-2 3.5L4 11v2l-2 1.5L4 18l2.5-.7 2 1.2L9 21h6l.5-2.5 2-1.2 2.5.7 2-3.5-2-1.5v-2l2-1.5L20 6l-2.5.7-2-1.2L15 3Z" /><circle cx="12" cy="12" r="3" /></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  category: <><path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2" /></>,
  package: <><path d="m12 3 9 5v9l-9 5-9-5V8Zm-9 5 9 5 9-5M12 13v9M7.5 5.5l9 5" /></>,
  channels: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="m8 2 4 4 4-4m-6 9 5 3-5 3Z" /></>,
  assign: <><rect x="3" y="4" width="13" height="17" rx="2" /><path d="M7 9h5M7 13h3m5 1 3 3 4-5" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" /></>,
  logout: <path d="M9 4H4v16h5m1-8h11m-4-4 4 4-4 4" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  collapse: <path d="M4 6h16M9 12h11M14 18h6" />,
};
export default function SidebarIcon({ name }: { name: IconName }) {
  return <svg className="sidebar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
