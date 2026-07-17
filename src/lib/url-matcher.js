function patternToRegex(pattern) {
  let hostPart = pattern;
  let pathPart = '';

  const slashIdx = pattern.indexOf('/');
  if (slashIdx >= 0) {
    hostPart = pattern.substring(0, slashIdx);
    pathPart = pattern.substring(slashIdx);
  }

  let hostRegex;
  if (hostPart.startsWith('*.')) {
    const domain = hostPart.substring(2).replace(/[.]/g, '\\.');
    hostRegex = '^([^.]+\\.)?' + domain + '$';
  } else {
    hostRegex = '^' + hostPart.replace(/[.]/g, '\\.') + '$';
  }

  let pathRegex = '';
  if (pathPart) {
    pathRegex = pathPart.replace(/[.]/g, '\\.').replace(/[*]/g, '.*');
  }

  return { hostRegex: new RegExp(hostRegex, 'i'), pathRegex: pathPart ? new RegExp('^' + pathRegex, 'i') : null, specificity: pattern.length + (pathPart ? 100 : 0) };
}

function matchUrl(pattern, urlStr) {
  try {
    const url = new URL(urlStr);
    const { hostRegex, pathRegex } = patternToRegex(pattern);
    if (!hostRegex.test(url.hostname)) return false;
    if (pathRegex && !pathRegex.test(url.pathname)) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function resolveAppForCurrentUrl(apps, sites, settings) {
  const currentUrl = window.location.href;

  console.log('[Dify CS] resolveAppForCurrentUrl:', {
    url: currentUrl,
    appsCount: apps.length,
    sitesCount: sites.length,
    sites: sites,
    showOnAllSites: settings.showOnAllSites,
    defaultAppId: settings.defaultAppId
  });

  const matches = sites
    .filter(s => s.enabled && matchUrl(s.pattern, currentUrl))
    .sort((a, b) => patternToRegex(b.pattern).specificity - patternToRegex(a.pattern).specificity);

  if (matches.length > 0) {
    const app = apps.find(a => a.id === matches[0].appId);
    if (app) return app;
  }

  if (settings.showOnAllSites) {
    const appId = settings.defaultAppId || (apps.length > 0 ? apps[0].id : null);
    if (appId) {
      const app = apps.find(a => a.id === appId);
      if (app) return app;
    }
  }

  return null;
}

function findSiteRule(sites, hostname) {
  return sites.find(s => {
    try {
      const { hostRegex } = patternToRegex(s.pattern);
      return hostRegex.test(hostname);
    } catch (e) {
      return false;
    }
  }) || null;
}
