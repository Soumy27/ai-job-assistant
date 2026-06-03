import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { logout } from '../utils/auth';

// Material Symbols icon helper.
const Icon = ({ name, className = '', fill = false }) => (
  <span
    className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`}
    aria-hidden="true"
  >
    {name}
  </span>
);

const Layout = () => {
  const location = useLocation();

  const navItems = [
    { name: 'Overview', path: '/', icon: 'dashboard' },
    { name: 'Profile', path: '/profile', icon: 'person' },
    { name: 'Resume AI', path: '/resume', icon: 'description' },
  ];

  const handleLogout = () => {
    logout();
    setTimeout(() => {
      window.location.href = '/login';
    }, 150);
  };

  return (
    <div className="min-h-screen flex font-body-md text-on-background">
      {/* Atmospheric background accent */}
      <div className="fixed top-0 right-0 w-[800px] h-[600px] bg-gradient-to-bl from-primary-fixed-dim/30 via-surface-container-lowest/10 to-transparent rounded-bl-full pointer-events-none -z-10 mix-blend-multiply opacity-50"></div>

      {/* Sidebar */}
      <aside className="bg-surface h-screen w-64 fixed left-0 top-0 flex flex-col p-md border-r border-outline-variant/50 z-40">
        {/* Brand */}
        <div className="mb-xl flex items-center gap-sm px-sm pt-sm">
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
            <Icon name="robot_2" fill className="text-on-primary-container" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md font-black text-primary tracking-tight">CareerAI</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant opacity-80">Pro Navigator</span>
          </div>
        </div>

        {/* Nav links */}
        <ul className="flex-1 flex flex-col gap-xs">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-md px-md py-sm rounded-lg transition-all duration-200 font-label-md text-label-md group ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <Icon name={item.icon} fill={isActive} className="transition-transform group-hover:scale-110" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Pro CTA */}
        <div className="mb-lg p-md rounded-xl bg-surface-container-low border border-outline-variant/30 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <Icon name="workspace_premium" fill className="text-primary mb-sm" />
            <p className="font-label-sm text-label-sm text-on-surface mb-md">Unlock advanced AI interview prep.</p>
            <button className="w-full py-2 px-4 ai-button text-on-primary rounded-lg font-label-md text-label-md shadow-sm">
              Upgrade to Pro
            </button>
          </div>
        </div>

        {/* Footer */}
        <ul className="flex flex-col gap-xs pt-sm border-t border-outline-variant/50">
          <li>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-md px-md py-sm text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-all font-label-md text-label-md"
            >
              <Icon name="help" />
              Help Center
            </a>
          </li>
          <li>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-md px-md py-sm text-error hover:bg-error-container hover:text-on-error-container rounded-lg transition-all font-label-md text-label-md cursor-pointer"
            >
              <Icon name="logout" />
              Logout
            </button>
          </li>
        </ul>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 p-margin-desktop">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
