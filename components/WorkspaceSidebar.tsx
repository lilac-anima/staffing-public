import { ClipboardCheck, KanbanSquare, LayoutDashboard, MessageCircle, Users } from 'lucide-react';

type WorkspaceSidebarProps = { active?: string };
const links = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/', label: 'Staff directory', icon: Users },
  { href: '/kanban', label: 'Kanban board', icon: KanbanSquare },
  { href: '/discussion', label: 'Agent discussion', icon: MessageCircle },
  { href: '/reviews', label: 'Reviews', icon: ClipboardCheck },
];
export default function WorkspaceSidebar({ active }: WorkspaceSidebarProps) {
  return <aside className="workspace-sidebar" aria-label="Workspace navigation"><a className="brand" href="/"><span className="brandmark">s</span>staffing<span className="dot">.</span></a><div className="workspace"><div className="workspace-icon">AI</div><div>Team workspace<small>Shared workspace</small></div></div><div className="navtitle">WORKSPACE</div>{links.map(({ href, label, icon: Icon }) => <a className={`nav${active === href ? ' active' : ''}`} href={href} aria-current={active === href ? 'page' : undefined} key={href}><Icon size={18}/>{label}</a>)}</aside>;
}
