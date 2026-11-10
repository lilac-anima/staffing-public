import type { Metadata } from 'next';
import './globals.css';
import LocalPreviewBanner from './LocalPreviewBanner';
import WorkspaceSidebar from '../components/WorkspaceSidebar';
export const metadata: Metadata = { title: 'Staffing — Agent directory', description: 'Your team of specialized agents.' };
export default function Layout({children}: {children: React.ReactNode}) { return <html lang="en"><body><LocalPreviewBanner/><WorkspaceSidebar/><nav className="global-site-nav" aria-label="Primary navigation"><a href="/overview">Overview</a><a href="/">Staff directory</a><a href="/kanban">Kanban board</a><a href="/discussion">Agent discussion</a><a href="/reviews">Reviews</a></nav>{children}</body></html> }
