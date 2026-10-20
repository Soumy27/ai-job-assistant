import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { logout } from '../utils/auth';
import Icon from './Icon';

const navItems = [
  { name: 'Overview', path: '/', icon: 'overview' },
  { name: 'Resume', path: '/resume', icon: 'upload' },
  { name: 'Profile', path: '/profile', icon: 'person' },
];

/**
 * Shell: "Open plane".
 * The sidebar sits on the page ground with no border and no fill of its own;
 * there is no top bar on desktop. The active item is a neutral grey pill —
 * not a brand colour, not a left bar.
 */
export default function Layout() {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const currentName =
    navItems.find((i) => i.path === location.pathname)?.name ?? 'Overview';

  const navList = (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-[2px]">
        {navItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/'}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                [
                  'flex h-8 items-center gap-[10px] rounded-md px-[10px] text-body transition-colors',
                  isActive
                    ? 'bg-[#e9e9e9] text-text'
                    : 'text-muted hover:bg-[#efefef] hover:text-text',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    name={item.icon}
                    className={isActive ? 'text-text' : 'text-muted'}
                  />
                  {item.name}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );

  const sidebarInner = (
    <div className="flex h-full flex-col px-3 py-5">
      {/* Scope: the product's name and whose pipeline this is. */}
      <div className="mb-7 px-[10px]">
        <div className="text-section font-semibold tracking-tight">CareerAI</div>
        <div className="text-small text-muted">Job pipeline</div>
      </div>

      {navList}

      <div className="mt-auto flex flex-col gap-[2px] pt-6">
        <a
          href="https://github.com/Soumy27/ai-job-assistant"
          target="_blank"
          rel="noreferrer"
          className="flex h-8 items-center gap-[10px] rounded-md px-[10px] text-body text-muted transition-colors hover:bg-[#efefef] hover:text-text"
        >
          <Icon name="external" className="text-muted" />
          Help
        </a>
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-8 cursor-pointer items-center gap-[10px] rounded-md px-[10px] text-body text-muted transition-colors hover:bg-[#efefef] hover:text-text"
        >
          <Icon name="logout" className="text-muted" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ground text-text">
      {/* Phone: the nav folds into a 48px bar with the screen's name. */}
      <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-ground px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="-ml-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-[#efefef]"
          aria-label="Open navigation"
        >
          <Icon name="menu" size={18} />
        </button>
        <span className="text-section font-medium">{currentName}</span>
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-50 bg-ground lg:hidden">
          <div className="flex h-12 items-center justify-between border-b border-border px-4">
            <span className="text-section font-semibold tracking-tight">CareerAI</span>
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-[#efefef]"
              aria-label="Close navigation"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="h-[calc(100%-48px)]">{sidebarInner}</div>
        </div>
      )}

      <aside className="fixed left-0 top-0 hidden h-screen w-64 lg:block">
        {sidebarInner}
      </aside>

      <main className="px-4 py-6 lg:ml-64 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
