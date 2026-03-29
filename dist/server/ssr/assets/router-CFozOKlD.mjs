import { c as toBrowserNavigationHref, d as stripBasePath, l as toSameOriginAppPath } from "../index.mjs";
import { a as getDomainLocaleUrl, i as addLocalePrefix, n as appendSearchParamsToUrl, r as urlQueryToSearchParams, t as addQueryParam } from "./query-zwdEkXKW.mjs";
import { createContext, createElement } from "react";
//#region node_modules/vinext/dist/shims/internal/router-context.js
/**
* Shim for next/dist/shared/lib/router-context.shared-runtime
*
* Used by: some testing utilities and older libraries.
* Provides the Pages Router context.
*/
var RouterContext = createContext(null);
//#endregion
//#region node_modules/vinext/dist/client/validate-module-path.js
/**
* Defense-in-depth: validate module paths before passing them to dynamic import().
*
* Shared between entry.ts (initial hydration) and router.ts (client-side navigation)
* to ensure all dynamic imports of page/app modules go through the same validation.
*
* Blocks:
* - Non-string or empty values
* - Paths that don't start with `/` or `./` (e.g., `https://evil.com/...`)
* - Protocol URLs (`://`)
* - Protocol-relative URLs (`//...`)
* - Directory traversal (`..`)
*/
function isValidModulePath(p) {
	if (typeof p !== "string" || p.length === 0) return false;
	if (!p.startsWith("/") && !p.startsWith("./")) return false;
	if (p.startsWith("//")) return false;
	if (p.includes("://")) return false;
	if (p.includes("..")) return false;
	return true;
}
//#endregion
//#region node_modules/vinext/dist/shims/router.js
/**
* next/router shim
*
* Provides useRouter() hook and Router singleton for Pages Router.
* Backed by the browser History API. Supports client-side navigation
* by fetching new page data and re-rendering the React root.
*/
/** basePath from next.config.js, injected by the plugin at build time */
var __basePath = "";
function createRouterEvents() {
	const listeners = /* @__PURE__ */ new Map();
	return {
		on(event, handler) {
			if (!listeners.has(event)) listeners.set(event, /* @__PURE__ */ new Set());
			listeners.get(event).add(handler);
		},
		off(event, handler) {
			listeners.get(event)?.delete(handler);
		},
		emit(event, ...args) {
			listeners.get(event)?.forEach((handler) => handler(...args));
		}
	};
}
var routerEvents = createRouterEvents();
function resolveUrl(url) {
	if (typeof url === "string") return url;
	let result = url.pathname ?? "/";
	if (url.query) {
		const params = urlQueryToSearchParams(url.query);
		result = appendSearchParamsToUrl(result, params);
	}
	return result;
}
/**
* When `as` is provided, use it as the navigation target. This is a
* simplification: Next.js keeps `url` and `as` as separate values (url for
* data fetching, as for the browser URL). We collapse them because vinext's
* navigateClient() fetches HTML from the target URL, so `as` must be a
* server-resolvable path. Purely decorative `as` values are not supported.
*/
function resolveNavigationTarget(url, as, locale) {
	return applyNavigationLocale(as ?? resolveUrl(url), locale);
}
function getDomainLocales() {
	return window.__NEXT_DATA__?.domainLocales;
}
function getCurrentHostname() {
	return window.location?.hostname;
}
function getDomainLocalePath(url, locale) {
	return getDomainLocaleUrl(url, locale, {
		basePath: __basePath,
		currentHostname: getCurrentHostname(),
		domainItems: getDomainLocales()
	});
}
/**
* Apply locale prefix to a URL for client-side navigation.
* Same logic as Link's applyLocaleToHref but reads from window globals.
*/
function applyNavigationLocale(url, locale) {
	if (!locale || typeof window === "undefined") return url;
	if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) return url;
	const domainLocalePath = getDomainLocalePath(url, locale);
	if (domainLocalePath) return domainLocalePath;
	return addLocalePrefix(url, locale, window.__VINEXT_DEFAULT_LOCALE__ ?? "");
}
/** Check if a URL is external (any URL scheme per RFC 3986, or protocol-relative) */
function isExternalUrl(url) {
	return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");
}
/** Resolve a hash URL to a basePath-stripped app URL for event payloads */
function resolveHashUrl(url) {
	if (typeof window === "undefined") return url;
	if (url.startsWith("#")) return stripBasePath(window.location.pathname, __basePath) + window.location.search + url;
	try {
		const parsed = new URL(url, window.location.href);
		return stripBasePath(parsed.pathname, __basePath) + parsed.search + parsed.hash;
	} catch {
		return url;
	}
}
/** Check if a href is only a hash change relative to the current URL */
function isHashOnlyChange(href) {
	if (href.startsWith("#")) return true;
	if (typeof window === "undefined") return false;
	try {
		const current = new URL(window.location.href);
		const next = new URL(href, window.location.href);
		return current.pathname === next.pathname && current.search === next.search && next.hash !== "";
	} catch {
		return false;
	}
}
/** Scroll to hash target element, or top if no hash */
function scrollToHash(hash) {
	if (!hash || hash === "#") {
		window.scrollTo(0, 0);
		return;
	}
	const el = document.getElementById(hash.slice(1));
	if (el) el.scrollIntoView({ behavior: "auto" });
}
/** Save current scroll position into history state for back/forward restoration */
function saveScrollPosition() {
	const state = window.history.state ?? {};
	window.history.replaceState({
		...state,
		__vinext_scrollX: window.scrollX,
		__vinext_scrollY: window.scrollY
	}, "");
}
/** Restore scroll position from history state */
function restoreScrollPosition(state) {
	if (state && typeof state === "object" && "__vinext_scrollY" in state) {
		const { __vinext_scrollX: x, __vinext_scrollY: y } = state;
		requestAnimationFrame(() => window.scrollTo(x, y));
	}
}
var _ssrContext = null;
var _getSSRContext = () => _ssrContext;
/**
* Extract param names from a Next.js route pattern.
* E.g., "/posts/[id]" → ["id"], "/docs/[...slug]" → ["slug"],
* "/shop/[[...path]]" → ["path"], "/blog/[year]/[month]" → ["year", "month"]
* Also handles internal format: "/posts/:id" → ["id"], "/docs/:slug+" → ["slug"]
*/
function extractRouteParamNames(pattern) {
	const names = [];
	const bracketMatches = pattern.matchAll(/\[{1,2}(?:\.\.\.)?([\w-]+)\]{1,2}/g);
	for (const m of bracketMatches) names.push(m[1]);
	if (names.length > 0) return names;
	const colonMatches = pattern.matchAll(/:([\w-]+)[+*]?/g);
	for (const m of colonMatches) names.push(m[1]);
	return names;
}
function getPathnameAndQuery() {
	if (typeof window === "undefined") {
		const _ssrCtx = _getSSRContext();
		if (_ssrCtx) {
			const query = {};
			for (const [key, value] of Object.entries(_ssrCtx.query)) query[key] = Array.isArray(value) ? [...value] : value;
			return {
				pathname: _ssrCtx.pathname,
				query,
				asPath: _ssrCtx.asPath
			};
		}
		return {
			pathname: "/",
			query: {},
			asPath: "/"
		};
	}
	const resolvedPath = stripBasePath(window.location.pathname, __basePath);
	const pathname = window.__NEXT_DATA__?.page ?? resolvedPath;
	const routeQuery = {};
	const nextData = window.__NEXT_DATA__;
	if (nextData && nextData.query && nextData.page) {
		const routeParamNames = extractRouteParamNames(nextData.page);
		for (const key of routeParamNames) {
			const value = nextData.query[key];
			if (typeof value === "string") routeQuery[key] = value;
			else if (Array.isArray(value)) routeQuery[key] = [...value];
		}
	}
	const searchQuery = {};
	const params = new URLSearchParams(window.location.search);
	for (const [key, value] of params) addQueryParam(searchQuery, key, value);
	return {
		pathname,
		query: {
			...searchQuery,
			...routeQuery
		},
		asPath: resolvedPath + window.location.search + window.location.hash
	};
}
/**
* Perform client-side navigation: fetch the target page's HTML,
* extract __NEXT_DATA__, and re-render the React root.
*/
var _navInProgress = false;
async function navigateClient(url) {
	if (typeof window === "undefined") return;
	const root = window.__VINEXT_ROOT__;
	if (!root) {
		window.location.href = url;
		return;
	}
	if (_navInProgress) return;
	_navInProgress = true;
	try {
		const res = await fetch(url, { headers: { Accept: "text/html" } });
		if (!res.ok) {
			window.location.href = url;
			return;
		}
		const html = await res.text();
		const match = html.match(/<script>window\.__NEXT_DATA__\s*=\s*(.*?)<\/script>/);
		if (!match) {
			window.location.href = url;
			return;
		}
		const nextData = JSON.parse(match[1]);
		const { pageProps } = nextData.props;
		window.__NEXT_DATA__ = nextData;
		let pageModuleUrl = nextData.__vinext?.pageModuleUrl;
		if (!pageModuleUrl) {
			const moduleMatch = html.match(/import\("([^"]+)"\);\s*\n\s*const PageComponent/);
			const altMatch = html.match(/await import\("([^"]+pages\/[^"]+)"\)/);
			pageModuleUrl = moduleMatch?.[1] ?? altMatch?.[1] ?? void 0;
		}
		if (!pageModuleUrl) {
			window.location.href = url;
			return;
		}
		if (!isValidModulePath(pageModuleUrl)) {
			console.error("[vinext] Blocked import of invalid page module path:", pageModuleUrl);
			window.location.href = url;
			return;
		}
		const PageComponent = (await import(
			/* @vite-ignore */
			pageModuleUrl
)).default;
		if (!PageComponent) {
			window.location.href = url;
			return;
		}
		const React = (await import("react")).default;
		let AppComponent = window.__VINEXT_APP__;
		const appModuleUrl = nextData.__vinext?.appModuleUrl;
		if (!AppComponent && appModuleUrl) if (!isValidModulePath(appModuleUrl)) console.error("[vinext] Blocked import of invalid app module path:", appModuleUrl);
		else try {
			AppComponent = (await import(
				/* @vite-ignore */
				appModuleUrl
)).default;
			window.__VINEXT_APP__ = AppComponent;
		} catch {}
		let element;
		if (AppComponent) element = React.createElement(AppComponent, {
			Component: PageComponent,
			pageProps
		});
		else element = React.createElement(PageComponent, pageProps);
		element = wrapWithRouterContext(element);
		root.render(element);
	} catch (err) {
		console.error("[vinext] Client navigation failed:", err);
		routerEvents.emit("routeChangeError", err, url, { shallow: false });
		window.location.href = url;
	} finally {
		_navInProgress = false;
	}
}
/**
* Build the full router value object from the current pathname, query, asPath,
* and a set of navigation methods.  Shared by useRouter() (which passes
* hook-derived callbacks) and wrapWithRouterContext() (which passes the Router
* singleton methods) so the shape stays in sync.
*/
function buildRouterValue(pathname, query, asPath, methods) {
	const _ssrState = _getSSRContext();
	const nextData = typeof window !== "undefined" ? window.__NEXT_DATA__ : void 0;
	const locale = typeof window === "undefined" ? _ssrState?.locale : window.__VINEXT_LOCALE__;
	const locales = typeof window === "undefined" ? _ssrState?.locales : window.__VINEXT_LOCALES__;
	const defaultLocale = typeof window === "undefined" ? _ssrState?.defaultLocale : window.__VINEXT_DEFAULT_LOCALE__;
	const domainLocales = typeof window === "undefined" ? _ssrState?.domainLocales : nextData?.domainLocales;
	return {
		pathname,
		route: typeof window !== "undefined" ? nextData?.page ?? pathname : pathname,
		query,
		asPath,
		basePath: __basePath,
		locale,
		locales,
		defaultLocale,
		domainLocales,
		isReady: true,
		isPreview: false,
		isFallback: typeof window !== "undefined" && nextData?.isFallback === true,
		...methods,
		events: routerEvents
	};
}
var _beforePopStateCb;
var _lastPathnameAndSearch = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
if (typeof window !== "undefined") window.addEventListener("popstate", (e) => {
	const browserUrl = window.location.pathname + window.location.search;
	const appUrl = stripBasePath(window.location.pathname, __basePath) + window.location.search;
	const isHashOnly = browserUrl === _lastPathnameAndSearch;
	if (_beforePopStateCb !== void 0) {
		if (!_beforePopStateCb({
			url: appUrl,
			as: appUrl,
			options: { shallow: false }
		})) return;
	}
	_lastPathnameAndSearch = browserUrl;
	if (isHashOnly) {
		const hashUrl = appUrl + window.location.hash;
		routerEvents.emit("hashChangeStart", hashUrl, { shallow: false });
		scrollToHash(window.location.hash);
		routerEvents.emit("hashChangeComplete", hashUrl, { shallow: false });
		window.dispatchEvent(new CustomEvent("vinext:navigate"));
		return;
	}
	const fullAppUrl = appUrl + window.location.hash;
	routerEvents.emit("routeChangeStart", fullAppUrl, { shallow: false });
	routerEvents.emit("beforeHistoryChange", fullAppUrl, { shallow: false });
	navigateClient(browserUrl).then(() => {
		routerEvents.emit("routeChangeComplete", fullAppUrl, { shallow: false });
		restoreScrollPosition(e.state);
		window.dispatchEvent(new CustomEvent("vinext:navigate"));
	});
});
/**
* Wrap a React element in a RouterContext.Provider so that
* next/compat/router's useRouter() returns the real Pages Router value.
*
* This is a plain function, NOT a React component — it builds the router
* value object directly from the current SSR context (server) or
* window.location + Router singleton (client), avoiding duplicate state
* that a hook-based component would create.
*/
function wrapWithRouterContext(element) {
	const { pathname, query, asPath } = getPathnameAndQuery();
	const routerValue = buildRouterValue(pathname, query, asPath, {
		push: Router.push,
		replace: Router.replace,
		back: Router.back,
		reload: Router.reload,
		prefetch: Router.prefetch,
		beforePopState: Router.beforePopState
	});
	return createElement(RouterContext.Provider, { value: routerValue }, element);
}
var Router = {
	push: async (url, as, options) => {
		let resolved = resolveNavigationTarget(url, as, options?.locale);
		if (isExternalUrl(resolved)) {
			const localPath = toSameOriginAppPath(resolved, __basePath);
			if (localPath == null) {
				window.location.assign(resolved);
				return true;
			}
			resolved = localPath;
		}
		const full = toBrowserNavigationHref(resolved, window.location.href, __basePath);
		if (isHashOnlyChange(resolved)) {
			const eventUrl = resolveHashUrl(resolved);
			routerEvents.emit("hashChangeStart", eventUrl, { shallow: options?.shallow ?? false });
			const hash = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
			window.history.pushState({}, "", resolved.startsWith("#") ? resolved : full);
			_lastPathnameAndSearch = window.location.pathname + window.location.search;
			scrollToHash(hash);
			routerEvents.emit("hashChangeComplete", eventUrl, { shallow: options?.shallow ?? false });
			window.dispatchEvent(new CustomEvent("vinext:navigate"));
			return true;
		}
		saveScrollPosition();
		routerEvents.emit("routeChangeStart", resolved, { shallow: options?.shallow ?? false });
		routerEvents.emit("beforeHistoryChange", resolved, { shallow: options?.shallow ?? false });
		window.history.pushState({}, "", full);
		_lastPathnameAndSearch = window.location.pathname + window.location.search;
		if (!options?.shallow) await navigateClient(full);
		routerEvents.emit("routeChangeComplete", resolved, { shallow: options?.shallow ?? false });
		const hash = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
		if (hash) scrollToHash(hash);
		else if (options?.scroll !== false) window.scrollTo(0, 0);
		window.dispatchEvent(new CustomEvent("vinext:navigate"));
		return true;
	},
	replace: async (url, as, options) => {
		let resolved = resolveNavigationTarget(url, as, options?.locale);
		if (isExternalUrl(resolved)) {
			const localPath = toSameOriginAppPath(resolved, __basePath);
			if (localPath == null) {
				window.location.replace(resolved);
				return true;
			}
			resolved = localPath;
		}
		const full = toBrowserNavigationHref(resolved, window.location.href, __basePath);
		if (isHashOnlyChange(resolved)) {
			const eventUrl = resolveHashUrl(resolved);
			routerEvents.emit("hashChangeStart", eventUrl, { shallow: options?.shallow ?? false });
			const hash = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
			window.history.replaceState({}, "", resolved.startsWith("#") ? resolved : full);
			_lastPathnameAndSearch = window.location.pathname + window.location.search;
			scrollToHash(hash);
			routerEvents.emit("hashChangeComplete", eventUrl, { shallow: options?.shallow ?? false });
			window.dispatchEvent(new CustomEvent("vinext:navigate"));
			return true;
		}
		routerEvents.emit("routeChangeStart", resolved, { shallow: options?.shallow ?? false });
		routerEvents.emit("beforeHistoryChange", resolved, { shallow: options?.shallow ?? false });
		window.history.replaceState({}, "", full);
		_lastPathnameAndSearch = window.location.pathname + window.location.search;
		if (!options?.shallow) await navigateClient(full);
		routerEvents.emit("routeChangeComplete", resolved, { shallow: options?.shallow ?? false });
		const hash = resolved.includes("#") ? resolved.slice(resolved.indexOf("#")) : "";
		if (hash) scrollToHash(hash);
		else if (options?.scroll !== false) window.scrollTo(0, 0);
		window.dispatchEvent(new CustomEvent("vinext:navigate"));
		return true;
	},
	back: () => window.history.back(),
	reload: () => window.location.reload(),
	prefetch: async (url) => {
		if (typeof document !== "undefined") {
			const link = document.createElement("link");
			link.rel = "prefetch";
			link.href = url;
			link.as = "document";
			document.head.appendChild(link);
		}
	},
	beforePopState: (cb) => {
		_beforePopStateCb = cb;
	},
	events: routerEvents
};
//#endregion
export { Router as default };
