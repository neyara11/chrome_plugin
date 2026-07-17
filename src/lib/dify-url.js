function buildChatbotUrl(baseUrl, variable, value) {
  if (!value) return baseUrl;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return baseUrl + separator + encodeURIComponent(variable) + '=' + encodeURIComponent(value);
}
