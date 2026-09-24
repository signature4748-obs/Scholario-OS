/* global __resourceQuery */

"use strict"

/**
 * Scholario gateway-aware lazy-compilation WEB client.
 *
 * Drop-in replacement for webpack's bundled lazy-compilation-web.js with
 * ONE behavioural change: WHERE the EventSource connects.
 *
 *   upstream:  new EventSource("http://localhost:<port>/lazy-compilation-using-…")
 *              → absolute URL to the dev machine. Visitors behind the
 *                sandbox gateway resolve "localhost" to THEIR OWN machine
 *                → connection fails → every lazy module rejects → blank page.
 *
 *   here:      gateway mode (default)
 *              new EventSource("/lazy-compilation-using-…?XTransformPort=<port>")
 *              → SAME-ORIGIN request the gateway forwards to the dev
 *                machine's backend port. Works for every visitor.
 *
 *              direct mode (fallback)
 *              If the same-origin connection errors before ever opening,
 *              retry once with the upstream absolute URL — that is the
 *              correct path for a local dev browser (no gateway in the
 *                way). Only if that also fails do we report the upstream
 *                error.
 *
 * The keepAlive()/error-reporting contract is byte-compatible with the
 * upstream client (webpack's LazyCompilationProxyModule calls it).
 */

if (typeof EventSource !== "function") {
	throw new Error(
		"Environment doesn't support lazy compilation (requires EventSource)"
	);
}

var urlBase = decodeURIComponent(__resourceQuery.slice(1));
var parsedBase;
try {
	parsedBase = new URL(urlBase);
} catch (e) {
	parsedBase = null;
}

var mode = "gateway"; // "gateway" → same-origin proxy; "direct" → absolute URL
/** @type {EventSource | undefined} */
var activeEventSource;
var activeKeys = new Map();
var errorHandlers = new Set();
var everOpened = false;

function buildUrl(keys) {
	if (mode === "gateway" && parsedBase) {
		// Same-origin path + the port as a gateway routing hint.
		return (
			parsedBase.pathname +
			keys +
			"?XTransformPort=" +
			parsedBase.port
		);
	}
	return urlBase + keys;
}

var updateEventSource = function updateEventSource() {
	if (activeEventSource) activeEventSource.close();
	if (activeKeys.size) {
		activeEventSource = new EventSource(
			buildUrl(Array.from(activeKeys.keys()).join("@"))
		);
		activeEventSource.onopen = function () {
			everOpened = true;
		};
		/**
		 * @this {EventSource}
		 * @param {Event & { message?: string, filename?: string, lineno?: number, colno?: number, error?: Error }} event event
		 */
		activeEventSource.onerror = function (event) {
			if (!everOpened) {
				if (mode === "gateway") {
					// Same-origin gateway attempt failed without ever opening —
					// retry direct (local-dev topology: no gateway in the way).
					mode = "direct";
					updateEventSource();
					return;
				}
			}
			errorHandlers.forEach(function (onError) {
				onError(
					new Error(
						"Problem communicating active modules to the server: " +
							event.message +
							" " +
							event.filename +
							":" +
							event.lineno +
							":" +
							event.colno +
							" " +
							event.error
					)
				);
			});
		};
	} else {
		activeEventSource = undefined;
	}
};

/**
 * @param {{ data: string, onError: (err: Error) => void, active: boolean, module: module }} options options
 * @returns {() => void} function to destroy response
 */
exports.keepAlive = function (options) {
	var data = options.data;
	var onError = options.onError;
	var active = options.active;
	// eslint-disable-next-line @next/next/no-assign-module-variable -- upstream webpack client contract: `module` is the webpack module API.
	var module = options.module;
	errorHandlers.add(onError);
	var value = activeKeys.get(data) || 0;
	activeKeys.set(data, value + 1);
	if (value === 0) {
		updateEventSource();
	}
	if (!active && !module.hot) {
		console.log(
			"Hot Module Replacement is not enabled. Waiting for process restart..."
		);
	}

	return function () {
		errorHandlers.delete(onError);
		setTimeout(function () {
			var value = activeKeys.get(data);
			if (value === 1) {
				activeKeys.delete(data);
				updateEventSource();
			} else {
				activeKeys.set(data, value - 1);
			}
		}, 1000);
	};
};
