const token = process.env['CORE_API_KEY']?.trim();

export default {
  '^/api/core/search/works/(?:aggregate)?(?:\\?|$)': {
    target: 'https://api.core.ac.uk',
    changeOrigin: true,
    pathRewrite: { '^/api/core/': '/v3/' },
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  },
};
