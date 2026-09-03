// MR-60: one shared render helper for component tests instead of every file
// hand-wrapping ThemeProvider/ToastProvider and re-stubbing matchMedia /
// ResizeObserver. See QuickLogForm.jsx (useToast) and the retrospective note
// on board.md for the two incidents this replaces.
import React from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import * as ThemeContextModule from './contexts/ThemeContext';
import * as ToastContextModule from './contexts/ToastContext';

// Re-export everything from testing-library so tests can import all their
// render helpers (screen, waitFor, fireEvent, cleanup, ...) from this one
// module alongside renderWithProviders. This is a test-only helper module,
// never part of the app's HMR graph, so fast-refresh's single-export-type
// rule doesn't apply here (see ThemeContext.jsx/ToastContext.jsx for the
// same disable on a real hook+Provider pairing).
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';

// jsdom lacks matchMedia and ResizeObserver; several components (ThemeContext
// itself, and any chart using recharts' ResponsiveContainer) need them to
// mount at all.
export function stubBrowserApis() {
	window.matchMedia = vi.fn().mockImplementation(() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	}));
	globalThis.ResizeObserver = globalThis.ResizeObserver || class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
}

// Some tests vi.mock('.../contexts/ToastContext') (or ThemeContext) with a
// factory that only exports the hook (e.g. `{ useToast: () => ({...}) }`),
// not the Provider. vitest's mocked-module proxy throws (rather than
// returning undefined) when a named export the factory never returned is
// read off the namespace, so a plain `Module.Provider || fallback` blows up
// instead of falling back — wrap the read in try/catch. Importing the module
// as a namespace this way keeps renderWithProviders working against both the
// real module and those mocks, instead of rendering `undefined`.
// eslint-disable-next-line react-refresh/only-export-components
const Passthrough = ({ children }) => children;

function safeProvider(mod, name) {
	try {
		return mod[name] || Passthrough;
	} catch {
		return Passthrough;
	}
}

export function renderWithProviders(ui, options) {
	stubBrowserApis();
	const ThemeProvider = safeProvider(ThemeContextModule, 'ThemeProvider');
	const ToastProvider = safeProvider(ToastContextModule, 'ToastProvider');
	return render(
		<ThemeProvider>
			<ToastProvider>{ui}</ToastProvider>
		</ThemeProvider>,
		options
	);
}
