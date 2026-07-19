// Module Federation async-bootstrap: deferring to ./bootstrap lets webpack
// negotiate shared deps (Angular singletons) before the app bootstraps.
import('./bootstrap');
