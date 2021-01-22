/**
 * This one is used on all parts of the admin panel.
 */

import * as Sentry from '@sentry/browser';
import { Integrations } from '@sentry/tracing';

Sentry.init({
  dsn: 'https://797cc582ba794c93934d01bf44722e96@o440904.ingest.sentry.io/5410617',

  // To set your release version
  release: 'community-website@' + process.env.npm_package_version,
  integrations: [new Integrations.BrowserTracing()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

import * as feather from 'feather-icons';
import $ from './libs/jquery';
import 'bootstrap/dist/js/bootstrap.bundle';
import './libs/arweave';

$(() => {
  feather.replace({ width: 16, height: 16 });

  try {
    // @ts-ignore
    $('[data-toggle="tooltip"]').tooltip();
  } catch (e) {}

  try {
    // @ts-ignore
    $('.toast').toast();
  } catch (e) {}
});
