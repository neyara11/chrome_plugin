function buildChatbotUrl(baseUrl, variable, value) {
  if (!value) return baseUrl;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return baseUrl + separator + encodeURIComponent(variable) + '=' + encodeURIComponent(value);
}

function buildOwuiApiUrl(baseUrl, path) {
  var url = baseUrl.replace(/\/+$/, '');
  if (/\/api(\/v\d+)?$/.test(url)) {
    return url + path;
  }
  return url + '/api' + path;
}
