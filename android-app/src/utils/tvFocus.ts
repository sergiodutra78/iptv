import type { KeyboardEvent } from 'react';

/**
 * Spread onto any div/li acting as a click target so it also works from a
 * Google TV remote: focusable via D-pad, and OK/Enter fires the same
 * handler a touch tap would. Real <button>/<a> elements already get this
 * for free; this is only needed for plain clickable divs.
 */
export const focusableCard = (onActivate: () => void) => ({
    tabIndex: 0,
    role: 'button' as const,
    onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate();
        }
    },
});
