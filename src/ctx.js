import { createContext } from 'react';

// Lives in its own module so hot-reloading a component never recreates it.
export const StudioCtx = createContext(null);

// True inside the panel docked next to the left rail: modals render as a panel there instead of over the page.
export const DockCtx = createContext(false);
